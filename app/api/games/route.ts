import { NextRequest, NextResponse } from 'next/server'
import { kvGet, kvSet } from '@/lib/kv'
import { fetchSchedule } from '@/lib/mlb-api'
import { fetchPitcherFipAndKPct, fetchTeamOBP, fetchLinescore } from '@/lib/mlb-api'
import { loadSavantStore, getSavantStats } from '@/lib/savant-api'
import { fetchWeather, getOutfieldFacingDegrees } from '@/lib/weather-api'
import { getParkFactor } from '@/lib/park-factors'
import { getGameStatus, computeFirstInningResult } from '@/lib/game-status'
import {
  computeLambda,
  computeYrfiProbability,
  breakEvenOdds,
  LEAGUE_AVG_FIP,
  LEAGUE_AVG_K_PCT,
  LEAGUE_AVG_BARREL_PCT,
  LEAGUE_AVG_OBP,
  LEAGUE_AVG_HARD_HIT_PCT,
} from '@/lib/poisson'
import type { GameResult, GamesResponse, PitcherStats } from '@/lib/types'

const RESPONSE_TTL_SECONDS = 300 // 5 minutes

function getPacificDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}

function currentSeason(): number {
  const pacificDate = getPacificDate()
  return parseInt(pacificDate.split('-')[0], 10)
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? getPacificDate()

  // KV cache check
  const cacheKey = `games-response:${date}`
  const cached = await kvGet<GamesResponse>(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    const season = currentSeason()
    const games = await fetchSchedule(date)

    if (games.length === 0) {
      const response: GamesResponse = { date, games: [], generatedAt: new Date().toISOString() }
      await kvSet(cacheKey, response, RESPONSE_TTL_SECONDS)
      return NextResponse.json(response)
    }

    // Load Savant store once for all pitchers
    const savantStore = await loadSavantStore(season)

    // Fetch weather for all venues in parallel
    const venueIds = [...new Set(games.map(g => g.venue.id))]
    const weatherByVenue = new Map<number, Awaited<ReturnType<typeof fetchWeather>>>()
    await Promise.all(
      venueIds.map(async venueId => {
        const game = games.find(g => g.venue.id === venueId)!
        const weather = await fetchWeather(venueId, game.gameDate)
        weatherByVenue.set(venueId, weather)
      })
    )

    // Fetch pitcher stats and team OBP in parallel (batch)
    const pitcherIds = [
      ...new Set(
        games.flatMap(g => {
          const ids = [g.teams.home.probablePitcher?.id, g.teams.away.probablePitcher?.id]
          return ids.filter((id): id is number => id !== undefined)
        })
      )
    ]
    const teamIds = [...new Set(games.flatMap(g => [g.teams.home.team.id, g.teams.away.team.id]))]

    const [pitcherStats, teamOBPs] = await Promise.all([
      Promise.all(pitcherIds.map(async id => ({ id, stats: await fetchPitcherFipAndKPct(id, season) }))),
      Promise.all(teamIds.map(async id => ({ id, obp: await fetchTeamOBP(id, season) }))),
    ])

    const pitcherStatsMap = new Map(pitcherStats.map(p => [p.id, p.stats]))
    const teamOBPMap = new Map(teamOBPs.map(t => [t.id, t.obp]))

    // Build results
    const results: GameResult[] = await Promise.all(
      games.map(async (game): Promise<GameResult> => {
        const gameStatus = getGameStatus(game.status.detailedState)
        const venueId = game.venue.id
        const weather = weatherByVenue.get(venueId) ?? { tempF: 72, windSpeedMph: 0, windFromDegrees: 0, failure: false }
        const parkFactor = getParkFactor(venueId)
        const outfieldFacing = getOutfieldFacingDegrees(venueId)

        function buildPitcherStats(
          pitcher: { id: number; fullName: string } | undefined,
        ): PitcherStats {
          if (!pitcher) {
            return {
              playerId: 0, name: 'TBD',
              fip: LEAGUE_AVG_FIP, kPct: LEAGUE_AVG_K_PCT,
              barrelRate: LEAGUE_AVG_BARREL_PCT, hardHitRate: LEAGUE_AVG_HARD_HIT_PCT,
              confirmed: false,
            }
          }
          const stats = pitcherStatsMap.get(pitcher.id) ?? { fip: LEAGUE_AVG_FIP, kPct: LEAGUE_AVG_K_PCT }
          const savant = getSavantStats(pitcher.id, savantStore)
          return {
            playerId: pitcher.id, name: pitcher.fullName,
            fip: stats.fip, kPct: stats.kPct,
            barrelRate: savant.barrelRate, hardHitRate: savant.hardHitRate,
            confirmed: true,
          }
        }

        const homePitcher = buildPitcherStats(game.teams.home.probablePitcher)
        const awayPitcher = buildPitcherStats(game.teams.away.probablePitcher)
        const homeOBP = teamOBPMap.get(game.teams.home.team.id) ?? LEAGUE_AVG_OBP
        const awayOBP = teamOBPMap.get(game.teams.away.team.id) ?? LEAGUE_AVG_OBP

        const sharedEnv = {
          parkFactor,
          tempF: weather.failure ? 72 : weather.tempF,
          windSpeedMph: weather.failure ? 0 : weather.windSpeedMph,
          windFromDegrees: weather.failure ? 0 : weather.windFromDegrees,
          outfieldFacingDegrees: outfieldFacing,
        }

        // Home team bats against away pitcher
        const lambdaHome = computeLambda({
          pitcherFip: awayPitcher.fip,
          pitcherKPct: awayPitcher.kPct,
          pitcherBarrelRate: awayPitcher.barrelRate,
          teamOBP: homeOBP,
          ...sharedEnv,
        })

        // Away team bats against home pitcher
        const lambdaAway = computeLambda({
          pitcherFip: homePitcher.fip,
          pitcherKPct: homePitcher.kPct,
          pitcherBarrelRate: homePitcher.barrelRate,
          teamOBP: awayOBP,
          ...sharedEnv,
        })

        const yrfiProbability = computeYrfiProbability(lambdaHome, lambdaAway)
        const odds = breakEvenOdds(yrfiProbability)

        let firstInningResult: GameResult['firstInningResult'] = 'pending'
        if (gameStatus === 'inProgress' || gameStatus === 'settled') {
          const linescore = await fetchLinescore(game.gamePk)
          firstInningResult = computeFirstInningResult(linescore)
        }

        return {
          gamePk: game.gamePk,
          gameTime: game.gameDate,
          gameStatus,
          venue: game.venue.name,
          venueId,
          homePitcher,
          awayPitcher,
          homeTeam: game.teams.home.team.name,
          awayTeam: game.teams.away.team.name,
          homeTeamId: game.teams.home.team.id,
          awayTeamId: game.teams.away.team.id,
          homeOBP,
          awayOBP,
          lambda: { home: lambdaHome, away: lambdaAway },
          yrfiProbability,
          breakEvenOdds: odds,
          weather,
          firstInningResult,
        }
      })
    )

    // Sort by YRFI probability descending
    results.sort((a, b) => b.yrfiProbability - a.yrfiProbability)

    const response: GamesResponse = {
      date,
      games: results,
      generatedAt: new Date().toISOString(),
    }

    await kvSet(cacheKey, response, RESPONSE_TTL_SECONDS)
    return NextResponse.json(response)
  } catch (err) {
    console.error('[/api/games] error:', err)
    return NextResponse.json({ error: 'Failed to load games', status: 500 }, { status: 500 })
  }
}
