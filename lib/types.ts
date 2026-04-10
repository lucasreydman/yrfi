export interface SavantStats {
  playerId: number
  barrelRate: number       // barrel_batted_rate from CSV (0–100 scale)
  hardHitRate: number      // hard_hit_percent from CSV (0–100 scale) — reserved for v2
  inningsPitched: number   // used only for 50 IP qualification check
}

export type PitcherStatus = 'confirmed' | 'probable' | 'tbd'

export interface PitcherStats {
  playerId: number
  name: string
  fip: number              // (13×HR + 3×(BB+HBP) − 2×K) / IP + 3.10
  kPct: number             // strikeouts / batters faced (0–1 scale)
  barrelRate: number       // from Savant; league avg fallback if < 50 IP or missing
  hardHitRate: number      // from Savant; league avg fallback
  confirmed: boolean       // true when starter is lineup/game confirmed
  status: PitcherStatus
}

export interface WeatherData {
  tempF: number
  windSpeedMph: number
  windFromDegrees: number  // direction wind is coming FROM (Open-Meteo convention)
  failure: boolean         // true if fetch failed; model factors default to 1.0
}

export interface GameResult {
  gamePk: number
  gameTime: string         // ISO string
  gameStatus: 'upcoming' | 'inProgress' | 'settled'
  venue: string
  venueId: number
  homePitcher: PitcherStats
  awayPitcher: PitcherStats
  homeTeam: string
  awayTeam: string
  homeTeamId: number
  awayTeamId: number
  homeOBP: number          // season team OBP
  awayOBP: number
  lambda: { home: number; away: number }
  yrfiProbability: number  // 0–1
  breakEvenOdds: number    // American odds integer (positive or negative)
  weather: WeatherData
  firstInningResult: 'run' | 'no_run' | 'pending'
}

export interface GamesResponse {
  date: string             // YYYY-MM-DD
  games: GameResult[]
  generatedAt: string      // ISO timestamp
}

export interface GamesErrorResponse {
  error: string
  status: number
}
