import {
  LEAGUE_AVG_FIP,
  LEAGUE_AVG_K_PCT,
  LEAGUE_AVG_BARREL_PCT,
  LEAGUE_AVG_OBP,
  tempFactor,
  windFactor,
} from './poisson'
import { getOutfieldFacingDegrees } from './weather-api'
import type { GameResult, PitcherStats } from './types'

export interface FactorBadge {
  label: string
  multiplier: number
  direction: 'up' | 'down' | 'neutral'
  description: string
}

export interface HalfInningBreakdown {
  pitcherFactors: FactorBadge[]
  lineupFactors: FactorBadge[]
  envFactors: FactorBadge[]
  lambda: number
}

export interface MatchupBreakdown {
  homeBats: HalfInningBreakdown  // home lineup bats vs away pitcher
  awayBats: HalfInningBreakdown  // away lineup bats vs home pitcher
}

function dir(m: number): 'up' | 'down' | 'neutral' {
  if (m > 1.025) return 'up'
  if (m < 0.975) return 'down'
  return 'neutral'
}

function badge(label: string, multiplier: number, description: string): FactorBadge {
  return { label, multiplier, direction: dir(multiplier), description }
}

function pitcherFactors(p: PitcherStats): FactorBadge[] {
  const fipM = Math.pow(p.fip / LEAGUE_AVG_FIP, 0.55)
  const rawK = 1 + 0.3 * (LEAGUE_AVG_K_PCT - p.kPct) / LEAGUE_AVG_K_PCT
  const kM = Math.max(0.85, Math.min(1.15, rawK))
  const barrelM = Math.pow(p.barrelRate / LEAGUE_AVG_BARREL_PCT, 0.35)

  const fipDesc =
    p.fip < 3.40 ? 'elite — limits run events' :
    p.fip > 4.30 ? 'hitter-friendly' :
    'near average'

  const kDesc =
    p.kPct > 0.27 ? 'high strikeout rate' :
    p.kPct < 0.19 ? 'low strikeout rate' :
    'average K rate'

  const barrelDesc =
    p.barrelRate < 6.0 ? 'limits hard contact' :
    p.barrelRate > 10.0 ? 'allows hard contact' :
    'average barrel rate'

  return [
    badge('FIP', fipM, fipDesc),
    badge('K%', kM, kDesc),
    badge('Barrel%', barrelM, barrelDesc),
  ]
}

function lineupFactors(
  teamOBP: number,
  topOfOrderOBP: number | null,
): FactorBadge[] {
  const obpM = Math.pow(teamOBP / LEAGUE_AVG_OBP, 0.70)
  const obpDesc =
    teamOBP > 0.330 ? 'strong lineup OBP' :
    teamOBP < 0.295 ? 'weak lineup OBP' :
    'average OBP'
  const badges: FactorBadge[] = [badge('Team OBP', obpM, obpDesc)]

  if (topOfOrderOBP !== null && teamOBP > 0) {
    const ratio = Math.min(Math.max(topOfOrderOBP / teamOBP, 0.90), 1.12)
    const topM = Math.pow(ratio, 0.45)
    const topDesc =
      ratio > 1.04 ? 'strong top of order' :
      ratio < 0.96 ? 'weak top of order' :
      'average top of order'
    badges.push(badge('Top of order', topM, topDesc))
  }

  return badges
}

export function computeMatchupBreakdown(game: GameResult): MatchupBreakdown {
  const { homePitcher, awayPitcher, homeOBP, awayOBP, topOfOrderOBP, weather, parkFactor } = game
  const outfieldFacing = getOutfieldFacingDegrees(game.venueId)

  const isControlled = weather.controlled || weather.failure
  const tempF = isControlled ? 72 : weather.tempF
  const windSpeedMph = isControlled ? 0 : weather.windSpeedMph
  const windFromDegrees = isControlled ? 0 : weather.windFromDegrees

  const tf = tempFactor(tempF)
  const wf = windFactor(windSpeedMph, windFromDegrees, outfieldFacing)

  const parkM = Math.pow(parkFactor, 0.50)
  const parkDesc =
    parkFactor > 1.05 ? `${((parkFactor - 1) * 100).toFixed(0)}% above avg — hitter-friendly` :
    parkFactor < 0.95 ? `${((1 - parkFactor) * 100).toFixed(0)}% below avg — pitcher-friendly` :
    'neutral park'

  const tempM = Math.pow(tf, 0.50)
  const tempDesc =
    tf < 1 ? `${tempF}°F — cold suppresses scoring` :
    tf > 1 ? `${tempF}°F — warm boosts scoring` :
    `${tempF}°F — neutral`

  const windM = Math.pow(wf, 0.50)
  let windDesc = 'calm — no effect'
  if (!isControlled && windSpeedMph >= 10) {
    let delta = Math.abs(windFromDegrees - outfieldFacing) % 360
    if (delta > 180) delta = 360 - delta
    if (delta <= 45) windDesc = `${windSpeedMph} mph blowing in`
    else if (delta >= 135) windDesc = `${windSpeedMph} mph blowing out`
    else windDesc = `${windSpeedMph} mph crosswind`
  } else if (!isControlled && windSpeedMph > 0) {
    windDesc = `${windSpeedMph} mph — light`
  }

  const envFactors: FactorBadge[] = isControlled
    ? [
        badge('Park', parkM, parkDesc),
        badge('Weather', 1.0, 'dome / roof — weather neutral'),
      ]
    : [
        badge('Park', parkM, parkDesc),
        badge('Temp', tempM, tempDesc),
        badge('Wind', windM, windDesc),
      ]

  return {
    homeBats: {
      pitcherFactors: pitcherFactors(awayPitcher),
      lineupFactors: lineupFactors(homeOBP, topOfOrderOBP.home),
      envFactors,
      lambda: game.lambda.home,
    },
    awayBats: {
      pitcherFactors: pitcherFactors(homePitcher),
      lineupFactors: lineupFactors(awayOBP, topOfOrderOBP.away),
      envFactors,
      lambda: game.lambda.away,
    },
  }
}
