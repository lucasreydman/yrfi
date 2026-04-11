import {
  TOP_OF_ORDER_OBP_STABILIZATION_PA,
  dateAdjustedStabilizationSample,
  FIP_CONSTANT,
  LEAGUE_AVG_FIP,
  LEAGUE_AVG_K_PCT,
  LEAGUE_AVG_OBP,
  PITCHER_FIP_STABILIZATION_IP,
  PITCHER_K_STABILIZATION_BF,
  TEAM_OBP_STABILIZATION_PA,
  shrinkTowardAverage,
} from './poisson'
import type { BatterRow } from './types'

const MLB_BASE = 'https://statsapi.mlb.com/api/v1'

// --- Schedule ---

export interface MlbScheduleGame {
  gamePk: number
  gameDate: string
  status: { detailedState: string }
  venue: { id: number; name: string }
  teams: {
    home: {
      team: { id: number; name: string }
      probablePitcher?: { id: number; fullName: string }
    }
    away: {
      team: { id: number; name: string }
      probablePitcher?: { id: number; fullName: string }
    }
  }
}

export async function fetchSchedule(date: string): Promise<MlbScheduleGame[]> {
  const url = `${MLB_BASE}/schedule?sportId=1&date=${date}&hydrate=probablePitcher,lineups`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Schedule fetch failed: ${res.status}`)
  const data = await res.json()
  const games: MlbScheduleGame[] = data.dates?.[0]?.games ?? []
  // Filter PPD/cancelled
  return games.filter(
    g => !['Postponed', 'Cancelled', 'Suspended'].includes(g.status.detailedState)
  )
}

// --- Pitcher stats ---

export interface MlbPitcherStatLine {
  homeRuns: number
  baseOnBalls: number
  hitByPitch: number
  strikeOuts: number
  inningsPitched: string  // e.g. "85.2" = 85 2/3 innings
  battersFaced: number
}

export interface PitcherModelStats {
  fip: number
  kPct: number
  inningsPitched: number
  battersFaced: number
  usedFallback: boolean
}

export interface MlbTeamBattingStatLine {
  obp?: string
  plateAppearances?: number
  atBats?: number
  baseOnBalls?: number
  hitByPitch?: number
  sacrificeFlies?: number
}

export interface TeamOffenseStats {
  obp: number
  plateAppearances: number
  usedFallback: boolean
}

export interface TeamLineupStats {
  topOfOrderOBP: number | null
  batterCount: number
  confirmed: boolean
  batters: BatterRow[]
}

export interface GameLineupStats {
  home: TeamLineupStats
  away: TeamLineupStats
}

interface MlbPlayerBattingStats {
  obp?: string
  plateAppearances?: number
}

interface MlbGameFeedPlayer {
  person?: { id: number; fullName: string }
  battingOrder?: string
  seasonStats?: {
    batting?: MlbPlayerBattingStats
  }
}

interface MlbGameFeedTeam {
  players?: Record<string, MlbGameFeedPlayer>
}

interface MlbGameFeedResponse {
  liveData?: {
    boxscore?: {
      teams?: {
        home?: MlbGameFeedTeam
        away?: MlbGameFeedTeam
      }
    }
  }
}

function parseIP(ip: string): number {
  const parts = ip.split('.')
  return parseInt(parts[0], 10) + (parseInt(parts[1] ?? '0', 10)) / 3
}

function calcFip(stat: MlbPitcherStatLine): number {
  const ip = parseIP(stat.inningsPitched)
  if (ip === 0) return LEAGUE_AVG_FIP
  return (13 * stat.homeRuns + 3 * (stat.baseOnBalls + stat.hitByPitch) - 2 * stat.strikeOuts) / ip + FIP_CONSTANT
}

function calcKPct(stat: MlbPitcherStatLine): number {
  if (stat.battersFaced === 0) return LEAGUE_AVG_K_PCT
  return stat.strikeOuts / stat.battersFaced
}

function estimateTeamPlateAppearances(stat: MlbTeamBattingStatLine): number {
  const explicitPlateAppearances = stat.plateAppearances ?? 0
  if (explicitPlateAppearances > 0) return explicitPlateAppearances

  return (
    (stat.atBats ?? 0) +
    (stat.baseOnBalls ?? 0) +
    (stat.hitByPitch ?? 0) +
    (stat.sacrificeFlies ?? 0)
  )
}

export async function fetchPitcherStatLine(
  playerId: number,
  season: number
): Promise<MlbPitcherStatLine | null> {
  const url = `${MLB_BASE}/people/${playerId}/stats?stats=season&group=pitching&season=${season}`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) return null
  const data = await res.json()
  return data.stats?.[0]?.splits?.[0]?.stat ?? null
}

export async function fetchPitcherFipAndKPct(
  playerId: number,
  season: number,
  date?: string,
): Promise<{ fip: number; kPct: number }> {
  const stats = await fetchPitcherModelStats(playerId, season, date)
  return { fip: stats.fip, kPct: stats.kPct }
}

export async function fetchPitcherModelStats(
  playerId: number,
  season: number,
  date?: string,
): Promise<PitcherModelStats> {
  const stat = await fetchPitcherStatLine(playerId, season)
  if (!stat) {
    return {
      fip: LEAGUE_AVG_FIP,
      kPct: LEAGUE_AVG_K_PCT,
      inningsPitched: 0,
      battersFaced: 0,
      usedFallback: true,
    }
  }

  const inningsPitched = parseIP(stat.inningsPitched)
  const battersFaced = stat.battersFaced ?? 0
  const rawFip = calcFip(stat)
  const rawKPct = calcKPct(stat)
  const fipStabilization = dateAdjustedStabilizationSample(PITCHER_FIP_STABILIZATION_IP, date)
  const kStabilization = dateAdjustedStabilizationSample(PITCHER_K_STABILIZATION_BF, date)

  return {
    fip: shrinkTowardAverage(rawFip, LEAGUE_AVG_FIP, inningsPitched, fipStabilization),
    kPct: shrinkTowardAverage(rawKPct, LEAGUE_AVG_K_PCT, battersFaced, kStabilization),
    inningsPitched,
    battersFaced,
    usedFallback: false,
  }
}

// --- Team OBP ---

export async function fetchTeamOBP(teamId: number, season: number): Promise<number> {
  const stats = await fetchTeamOffenseStats(teamId, season)
  return stats.obp
}

export async function fetchTeamOffenseStats(teamId: number, season: number, date?: string): Promise<TeamOffenseStats> {
  const url = `${MLB_BASE}/teams/${teamId}/stats?stats=season&group=hitting&season=${season}`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) {
    return { obp: LEAGUE_AVG_OBP, plateAppearances: 0, usedFallback: true }
  }

  const data = await res.json()
  const stat: MlbTeamBattingStatLine | null = data.stats?.[0]?.splits?.[0]?.stat ?? null
  if (!stat?.obp) {
    return { obp: LEAGUE_AVG_OBP, plateAppearances: 0, usedFallback: true }
  }

  const plateAppearances = estimateTeamPlateAppearances(stat)
  const stabilizationSample = dateAdjustedStabilizationSample(TEAM_OBP_STABILIZATION_PA, date)
  return {
    obp: shrinkTowardAverage(parseFloat(stat.obp), LEAGUE_AVG_OBP, plateAppearances, stabilizationSample),
    plateAppearances,
    usedFallback: false,
  }
}

// Batter participation weights for the first inning.
// P(batter N comes up) = P(< 3 outs accumulated in PAs 1…N-1).
// Using P(out per PA) = 1 − LEAGUE_AVG_OBP ≈ 0.690:
//   Batters 1–3: 1.000  (two PAs cannot produce 3 outs — guaranteed)
//   Batter 4:    1 − 0.69³               = 0.672
//   Batter 5:    P(X ≤ 2 | Bin(4, 0.69)) = 0.366
const TOP_OF_ORDER_BATTER_WEIGHTS = [1.0, 1.0, 1.0, 0.672, 0.366] as const

export function extractTopOfOrderStats(
  players: Record<string, MlbGameFeedPlayer> | undefined,
  date?: string,
): TeamLineupStats {
  if (!players) {
    return { topOfOrderOBP: null, batterCount: 0, confirmed: false, batters: [] }
  }

  const orderedHitters = Object.values(players)
    .filter(player => Boolean(player.battingOrder))
    .sort((left, right) => parseInt(left.battingOrder ?? '0', 10) - parseInt(right.battingOrder ?? '0', 10))
    .slice(0, TOP_OF_ORDER_BATTER_WEIGHTS.length)

  if (orderedHitters.length < 3) {
    return { topOfOrderOBP: null, batterCount: orderedHitters.length, confirmed: false, batters: [] }
  }

  const stabilizationSample = dateAdjustedStabilizationSample(TOP_OF_ORDER_OBP_STABILIZATION_PA, date)

  let weightedSum = 0
  let totalWeight = 0
  let validCount = 0
  const batters: BatterRow[] = []

  for (let i = 0; i < orderedHitters.length; i++) {
    const player = orderedHitters[i]
    const weight = TOP_OF_ORDER_BATTER_WEIGHTS[i]
    const batting = player.seasonStats?.batting
    const rawObp = parseFloat(batting?.obp ?? '')
    const plateAppearances = batting?.plateAppearances ?? 0
    if (!Number.isFinite(rawObp)) continue

    const stabilizedObp = shrinkTowardAverage(rawObp, LEAGUE_AVG_OBP, plateAppearances, stabilizationSample)
    weightedSum += stabilizedObp * weight
    totalWeight += weight
    validCount++

    batters.push({
      name: player.person?.fullName ?? `Batter ${i + 1}`,
      battingSlot: i + 1,
      obp: rawObp,
      stabilizedObp,
      plateAppearances,
    })
  }

  if (validCount < 3 || totalWeight === 0) {
    return { topOfOrderOBP: null, batterCount: validCount, confirmed: false, batters: [] }
  }

  return {
    topOfOrderOBP: weightedSum / totalWeight,
    batterCount: validCount,
    confirmed: true,
    batters,
  }
}

export async function fetchGameLineupStats(gamePk: number, date?: string): Promise<GameLineupStats> {
  const url = `${MLB_BASE}.1/game/${gamePk}/feed/live`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    return {
      home: { topOfOrderOBP: null, batterCount: 0, confirmed: false, batters: [] },
      away: { topOfOrderOBP: null, batterCount: 0, confirmed: false, batters: [] },
    }
  }

  const data: MlbGameFeedResponse = await res.json()
  const teams = data.liveData?.boxscore?.teams

  return {
    home: extractTopOfOrderStats(teams?.home?.players, date),
    away: extractTopOfOrderStats(teams?.away?.players, date),
  }
}

// --- Linescore ---

export interface MlbLinescore {
  innings: Array<{
    away?: { runs?: number }
    home?: { runs?: number }
  }>
}

export async function fetchLinescore(gamePk: number): Promise<MlbLinescore> {
  const url = `${MLB_BASE}/game/${gamePk}/linescore`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return { innings: [] }
  return res.json()
}
