export const LEAGUE_AVG_FIP = 3.80
export const LEAGUE_AVG_K_PCT = 0.23
export const LEAGUE_AVG_BARREL_PCT = 8.0
export const LEAGUE_AVG_OBP = 0.310
export const BASE_LAMBDA = 0.50
export const FIP_CONSTANT = 3.10
export const LEAGUE_AVG_HARD_HIT_PCT = 38.0

export function tempFactor(tempF: number): number {
  if (tempF < 55) return 0.92
  if (tempF > 80) return 1.06
  return 1.00
}

export function windFactor(
  windSpeedMph: number,
  windFromDegrees: number,
  outfieldFacingDegrees: number,
): number {
  if (windSpeedMph < 10) return 1.00

  let delta = Math.abs(windFromDegrees - outfieldFacingDegrees) % 360
  if (delta > 180) delta = 360 - delta

  if (delta <= 45) return 0.93   // blowing in
  if (delta >= 135) return 1.08  // blowing out
  return 1.00                    // crosswind
}

export interface LambdaParams {
  pitcherFip: number
  pitcherKPct: number        // 0–1 scale
  pitcherBarrelRate: number  // 0–100 scale
  teamOBP: number
  parkFactor: number
  tempF: number
  windSpeedMph: number
  windFromDegrees: number
  outfieldFacingDegrees: number
}

export function computeLambda(params: LambdaParams): number {
  const {
    pitcherFip,
    pitcherKPct,
    pitcherBarrelRate,
    teamOBP,
    parkFactor,
    tempF,
    windSpeedMph,
    windFromDegrees,
    outfieldFacingDegrees,
  } = params

  const fipFactor = pitcherFip / LEAGUE_AVG_FIP

  const rawKFactor = 1 + 0.3 * (LEAGUE_AVG_K_PCT - pitcherKPct) / LEAGUE_AVG_K_PCT
  const kFactor = Math.max(0.85, Math.min(1.15, rawKFactor))

  const barrelFactor = pitcherBarrelRate / LEAGUE_AVG_BARREL_PCT

  const obpFactor = teamOBP / LEAGUE_AVG_OBP

  const tf = tempFactor(tempF)
  const wf = windFactor(windSpeedMph, windFromDegrees, outfieldFacingDegrees)

  return BASE_LAMBDA * fipFactor * kFactor * barrelFactor * obpFactor * parkFactor * tf * wf
}

export function computeYrfiProbability(lambdaHome: number, lambdaAway: number): number {
  const pHomeScores0 = Math.exp(-lambdaHome)
  const pAwayScores0 = Math.exp(-lambdaAway)
  return 1 - pHomeScores0 * pAwayScores0
}

export function breakEvenOdds(p: number): number {
  if (p >= 0.5) return -Math.ceil((100 * p) / (1 - p))
  return Math.ceil((100 * (1 - p)) / p)
}

export function formatOdds(odds: number, estimated: boolean): string {
  // -100 is even money — display as +100
  const display = odds === -100 ? '+100' : odds > 0 ? `+${odds}` : `${odds}`
  const prefix = estimated ? '~' : ''
  return `${prefix}${display} or better`
}
