import {
  FIP_CONSTANT,
  LEAGUE_AVG_FIP,
  LEAGUE_AVG_K_PCT,
  LEAGUE_AVG_OBP,
  PITCHER_FIP_STABILIZATION_IP,
  PITCHER_K_STABILIZATION_BF,
  TEAM_OBP_STABILIZATION_PA,
  shrinkTowardAverage,
} from './poisson'

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
  season: number
): Promise<{ fip: number; kPct: number }> {
  const stats = await fetchPitcherModelStats(playerId, season)
  return { fip: stats.fip, kPct: stats.kPct }
}

export async function fetchPitcherModelStats(
  playerId: number,
  season: number
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

  return {
    fip: shrinkTowardAverage(rawFip, LEAGUE_AVG_FIP, inningsPitched, PITCHER_FIP_STABILIZATION_IP),
    kPct: shrinkTowardAverage(rawKPct, LEAGUE_AVG_K_PCT, battersFaced, PITCHER_K_STABILIZATION_BF),
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

export async function fetchTeamOffenseStats(teamId: number, season: number): Promise<TeamOffenseStats> {
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
  return {
    obp: shrinkTowardAverage(parseFloat(stat.obp), LEAGUE_AVG_OBP, plateAppearances, TEAM_OBP_STABILIZATION_PA),
    plateAppearances,
    usedFallback: false,
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
