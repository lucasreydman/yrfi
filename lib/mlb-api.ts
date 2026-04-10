const MLB_BASE = 'https://statsapi.mlb.com/api/v1'

// --- Schedule ---

export interface MlbScheduleGame {
  gamePk: number
  gameDate: string
  status: { detailedState: string }
  venue: { id: number; name: string }
  lineups?: {
    homePlayers?: Array<{ id: number }>
    awayPlayers?: Array<{ id: number }>
  }
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

function parseIP(ip: string): number {
  const parts = ip.split('.')
  return parseInt(parts[0], 10) + (parseInt(parts[1] ?? '0', 10)) / 3
}

function calcFip(stat: MlbPitcherStatLine): number {
  const ip = parseIP(stat.inningsPitched)
  if (ip === 0) return 3.80 // fallback to league avg
  return (13 * stat.homeRuns + 3 * (stat.baseOnBalls + stat.hitByPitch) - 2 * stat.strikeOuts) / ip + 3.10
}

function calcKPct(stat: MlbPitcherStatLine): number {
  if (stat.battersFaced === 0) return 0.23
  return stat.strikeOuts / stat.battersFaced
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
  const stat = await fetchPitcherStatLine(playerId, season)
  if (!stat) return { fip: 3.80, kPct: 0.23 }
  return { fip: calcFip(stat), kPct: calcKPct(stat) }
}

// --- Team OBP ---

export async function fetchTeamOBP(teamId: number, season: number): Promise<number> {
  const url = `${MLB_BASE}/teams/${teamId}/stats?stats=season&group=hitting&season=${season}`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) return 0.310
  const data = await res.json()
  const obp = data.stats?.[0]?.splits?.[0]?.stat?.obp
  return obp ? parseFloat(obp) : 0.310
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
