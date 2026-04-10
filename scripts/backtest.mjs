import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import Papa from 'papaparse'

const LEAGUE_AVG_FIP = 3.8
const LEAGUE_AVG_K_PCT = 0.23
const LEAGUE_AVG_BARREL_PCT = 8.0
const LEAGUE_AVG_OBP = 0.31
const BASE_LAMBDA = 0.36
const FIP_CONSTANT = 3.1
const PITCHER_FIP_STABILIZATION_IP = 45
const PITCHER_K_STABILIZATION_BF = 150
const TEAM_OBP_STABILIZATION_PA = 600
const SAVANT_STABILIZATION_IP = 50
const TOP_OF_ORDER_OBP_STABILIZATION_PA = 180
const RESPONSE_DELAY_MS = 0

const FIP_FACTOR_WEIGHT = 0.55
const BARREL_FACTOR_WEIGHT = 0.35
const OBP_FACTOR_WEIGHT = 0.7
const TOP_OF_ORDER_FACTOR_WEIGHT = 0.45
const PARK_FACTOR_WEIGHT = 0.5
const WEATHER_FACTOR_WEIGHT = 0.5
const MIN_ADJUSTMENT_FACTOR = 0.55
const MAX_ADJUSTMENT_FACTOR = 1.55
const BACKTEST_CACHE_VERSION = 'v2'

const PARK_FACTORS = {
  1: 0.97, 2: 0.97, 3: 1.02, 4: 0.96, 5: 0.97, 7: 1.0, 10: 0.97, 12: 0.96,
  14: 1.0, 15: 1.03, 17: 1.04, 19: 1.28, 22: 0.93, 31: 0.96, 32: 1.01,
  680: 0.95, 2392: 1.01, 2394: 0.97, 2395: 0.9, 2602: 1.0, 2680: 0.88,
  2681: 1.0, 2889: 0.96, 3289: 1.01, 3309: 1.0, 3312: 1.0, 3313: 1.02,
  4169: 0.94, 4705: 1.0, 5325: 1.05,
}

const STADIUMS = {
  1: { lat: 33.8003, lon: -117.8827, outfieldFacingDegrees: 280 },
  2: { lat: 39.2838, lon: -76.6218, outfieldFacingDegrees: 335 },
  3: { lat: 42.3467, lon: -71.0972, outfieldFacingDegrees: 95 },
  4: { lat: 41.83, lon: -87.6341, outfieldFacingDegrees: 5 },
  5: { lat: 41.4962, lon: -81.6852, outfieldFacingDegrees: 5 },
  7: { lat: 39.0517, lon: -94.4803, outfieldFacingDegrees: 330 },
  10: { lat: 37.7516, lon: -122.2005, outfieldFacingDegrees: 330 },
  12: { lat: 27.7683, lon: -82.6534, outfieldFacingDegrees: 0, weatherControlled: true },
  14: { lat: 43.6414, lon: -79.3894, outfieldFacingDegrees: 0, weatherControlled: true },
  15: { lat: 33.4455, lon: -112.0667, outfieldFacingDegrees: 340, weatherControlled: true },
  17: { lat: 41.9484, lon: -87.6553, outfieldFacingDegrees: 353 },
  19: { lat: 39.7559, lon: -104.9942, outfieldFacingDegrees: 347 },
  22: { lat: 34.0739, lon: -118.24, outfieldFacingDegrees: 305 },
  31: { lat: 40.4468, lon: -80.0057, outfieldFacingDegrees: 15 },
  32: { lat: 43.028, lon: -87.9712, outfieldFacingDegrees: 5, weatherControlled: true },
  680: { lat: 47.5914, lon: -122.3325, outfieldFacingDegrees: 0 },
  2392: { lat: 29.7573, lon: -95.3555, outfieldFacingDegrees: 350, weatherControlled: true },
  2394: { lat: 42.339, lon: -83.0485, outfieldFacingDegrees: 350 },
  2395: { lat: 37.7786, lon: -122.3893, outfieldFacingDegrees: 35 },
  2602: { lat: 39.0979, lon: -84.5082, outfieldFacingDegrees: 20 },
  2680: { lat: 32.7073, lon: -117.1566, outfieldFacingDegrees: 307 },
  2681: { lat: 39.9061, lon: -75.1665, outfieldFacingDegrees: 350 },
  2889: { lat: 38.6226, lon: -90.1928, outfieldFacingDegrees: 346 },
  3289: { lat: 40.7571, lon: -73.8458, outfieldFacingDegrees: 5 },
  3309: { lat: 38.873, lon: -77.0074, outfieldFacingDegrees: 355 },
  3312: { lat: 44.9817, lon: -93.2781, outfieldFacingDegrees: 30 },
  3313: { lat: 40.8296, lon: -73.9262, outfieldFacingDegrees: 25 },
  4169: { lat: 25.7781, lon: -80.2197, outfieldFacingDegrees: 320, weatherControlled: true },
  4705: { lat: 33.8909, lon: -84.4679, outfieldFacingDegrees: 335 },
  5325: { lat: 32.7473, lon: -97.0845, outfieldFacingDegrees: 0, weatherControlled: true },
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function shrinkTowardAverage(value, average, sampleSize, stabilizationSample) {
  if (!Number.isFinite(value)) return average
  if (sampleSize <= 0 || stabilizationSample <= 0) return average
  const weight = sampleSize / (sampleSize + stabilizationSample)
  return average + (value - average) * weight
}

function stabilizationMultiplierForDate(date) {
  const parsed = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return 1

  const year = parsed.getUTCFullYear()
  const openingWindowStart = Date.UTC(year, 2, 15)
  const stabilizationFloorDate = Date.UTC(year, 6, 1)
  const progress = clamp(
    (parsed.getTime() - openingWindowStart) / (stabilizationFloorDate - openingWindowStart),
    0,
    1,
  )

  return 1.75 - 0.75 * progress
}

function informationStabilizationMultiplierForDate(date) {
  const parsed = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return 1

  const year = parsed.getUTCFullYear()
  const openingWindowStart = Date.UTC(year, 2, 15)
  const stabilizationFloorDate = Date.UTC(year, 6, 1)
  const progress = clamp(
    (parsed.getTime() - openingWindowStart) / (stabilizationFloorDate - openingWindowStart),
    0,
    1,
  )

  const effectiveInformation = 0.23 + 0.77 * progress
  return clamp(1 / Math.sqrt(effectiveInformation), 1, 1.85)
}

function dateAdjustedStabilizationSample(baseSample, date) {
  if (!date) return baseSample
  return baseSample * stabilizationMultiplierForDate(date)
}

function informationDateAdjustedStabilizationSample(baseSample, date) {
  if (!date) return baseSample
  return baseSample * informationStabilizationMultiplierForDate(date)
}

function legacyStabilizationSample(baseSample) {
  return baseSample
}

function parseIp(ip) {
  const [whole, partial = '0'] = String(ip).split('.')
  return Number.parseInt(whole, 10) + Number.parseInt(partial, 10) / 3
}

function tempFactor(tempF) {
  if (tempF < 55) return 0.92
  if (tempF > 80) return 1.06
  return 1.0
}

function windFactor(windSpeedMph, windFromDegrees, outfieldFacingDegrees) {
  if (windSpeedMph < 10) return 1.0
  let delta = Math.abs(windFromDegrees - outfieldFacingDegrees) % 360
  if (delta > 180) delta = 360 - delta
  if (delta <= 45) return 0.93
  if (delta >= 135) return 1.08
  return 1.0
}

function computeLambda({ pitcherFip, pitcherKPct, pitcherBarrelRate, teamOBP, topOfOrderOBP, parkFactor, tempF, windSpeedMph, windFromDegrees, outfieldFacingDegrees }) {
  const fipFactor = Math.pow(pitcherFip / LEAGUE_AVG_FIP, FIP_FACTOR_WEIGHT)
  const rawKFactor = 1 + 0.3 * (LEAGUE_AVG_K_PCT - pitcherKPct) / LEAGUE_AVG_K_PCT
  const kFactor = clamp(rawKFactor, 0.85, 1.15)
  const barrelFactor = Math.pow(pitcherBarrelRate / LEAGUE_AVG_BARREL_PCT, BARREL_FACTOR_WEIGHT)
  const obpFactor = Math.pow(teamOBP / LEAGUE_AVG_OBP, OBP_FACTOR_WEIGHT)
  const topOfOrderRatio = topOfOrderOBP && teamOBP > 0
    ? clamp(topOfOrderOBP / teamOBP, 0.9, 1.12)
    : 1
  const topOfOrderFactor = Math.pow(topOfOrderRatio, TOP_OF_ORDER_FACTOR_WEIGHT)
  const parkAdjustment = Math.pow(parkFactor, PARK_FACTOR_WEIGHT)
  const weatherAdjustment = Math.pow(tempFactor(tempF) * windFactor(windSpeedMph, windFromDegrees, outfieldFacingDegrees), WEATHER_FACTOR_WEIGHT)
  const combinedAdjustment = clamp(
    fipFactor * kFactor * barrelFactor * obpFactor * topOfOrderFactor * parkAdjustment * weatherAdjustment,
    MIN_ADJUSTMENT_FACTOR,
    MAX_ADJUSTMENT_FACTOR,
  )
  return BASE_LAMBDA * combinedAdjustment
}

function computeLambdaLegacy({ pitcherFip, pitcherKPct, pitcherBarrelRate, teamOBP, parkFactor, tempF, windSpeedMph, windFromDegrees, outfieldFacingDegrees }) {
  const fipFactor = Math.pow(pitcherFip / LEAGUE_AVG_FIP, FIP_FACTOR_WEIGHT)
  const rawKFactor = 1 + 0.3 * (LEAGUE_AVG_K_PCT - pitcherKPct) / LEAGUE_AVG_K_PCT
  const kFactor = clamp(rawKFactor, 0.85, 1.15)
  const barrelFactor = Math.pow(pitcherBarrelRate / LEAGUE_AVG_BARREL_PCT, BARREL_FACTOR_WEIGHT)
  const obpFactor = Math.pow(teamOBP / LEAGUE_AVG_OBP, OBP_FACTOR_WEIGHT)
  const parkAdjustment = Math.pow(parkFactor, PARK_FACTOR_WEIGHT)
  const weatherAdjustment = Math.pow(tempFactor(tempF) * windFactor(windSpeedMph, windFromDegrees, outfieldFacingDegrees), WEATHER_FACTOR_WEIGHT)
  const combinedAdjustment = clamp(
    fipFactor * kFactor * barrelFactor * obpFactor * parkAdjustment * weatherAdjustment,
    MIN_ADJUSTMENT_FACTOR,
    MAX_ADJUSTMENT_FACTOR,
  )
  return BASE_LAMBDA * combinedAdjustment
}

function getStabilizationSample(baseSample, date, taperMode) {
  if (taperMode === 'legacy') return legacyStabilizationSample(baseSample)
  if (taperMode === 'info') return informationDateAdjustedStabilizationSample(baseSample, date)
  return dateAdjustedStabilizationSample(baseSample, date)
}

function computeYrfiProbability(lambdaHome, lambdaAway) {
  return 1 - Math.exp(-(lambdaHome + lambdaAway))
}

function dateRange(startDate, endDate) {
  const dates = []
  const current = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return dates
}

function getParkFactor(venueId) {
  return PARK_FACTORS[venueId] ?? 1.0
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${url}`)
  }
  return res.json()
}

async function fetchText(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${url}`)
  }
  return res.text()
}

async function fetchSchedule(date) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher,lineups`
  const data = await fetchJson(url)
  return (data.dates?.[0]?.games ?? []).filter(
    game => game.gameType === 'R' && !['Postponed', 'Cancelled', 'Suspended'].includes(game.status.detailedState)
  )
}

async function loadSavantStore(year) {
  const csv = await fetchText(`https://baseballsavant.mlb.com/leaderboard/statcast?type=pitcher&year=${year}&position=SP,RP&team=&min=1&csv=true`)
  const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true })
  const store = new Map()
  for (const record of data) {
    const playerId = Number.parseInt(record.player_id, 10)
    if (Number.isNaN(playerId)) continue
    store.set(playerId, {
      barrelRate: Number.parseFloat(record.barrel_batted_rate ?? '0'),
      hardHitRate: Number.parseFloat(record.hard_hit_percent ?? '0'),
      inningsPitched: parseIp(record.p_formatted_ip ?? '0'),
    })
  }
  return store
}

function getSavantStats(playerId, store, date, taperMode = 'info') {
  const entry = store.get(playerId)
  if (!entry) {
    return { barrelRate: LEAGUE_AVG_BARREL_PCT, hardHitRate: 38.0 }
  }
  const stabilizationSample = getStabilizationSample(SAVANT_STABILIZATION_IP, date, taperMode)
  return {
    barrelRate: shrinkTowardAverage(entry.barrelRate, LEAGUE_AVG_BARREL_PCT, entry.inningsPitched, stabilizationSample),
    hardHitRate: shrinkTowardAverage(entry.hardHitRate, 38.0, entry.inningsPitched, stabilizationSample),
  }
}

async function fetchPitcherStats(playerId, season, date, taperMode = 'info') {
  const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&group=pitching&season=${season}`
  const data = await fetchJson(url)
  const stat = data.stats?.[0]?.splits?.[0]?.stat
  if (!stat) return { fip: LEAGUE_AVG_FIP, kPct: LEAGUE_AVG_K_PCT, usedFallback: true }
  const inningsPitched = parseIp(stat.inningsPitched)
  const battersFaced = stat.battersFaced ?? 0
  const rawFip = inningsPitched === 0
    ? LEAGUE_AVG_FIP
    : (13 * stat.homeRuns + 3 * (stat.baseOnBalls + stat.hitByPitch) - 2 * stat.strikeOuts) / inningsPitched + FIP_CONSTANT
  const rawKPct = battersFaced === 0 ? LEAGUE_AVG_K_PCT : stat.strikeOuts / battersFaced
  const fipStabilization = getStabilizationSample(PITCHER_FIP_STABILIZATION_IP, date, taperMode)
  const kStabilization = getStabilizationSample(PITCHER_K_STABILIZATION_BF, date, taperMode)
  return {
    fip: shrinkTowardAverage(rawFip, LEAGUE_AVG_FIP, inningsPitched, fipStabilization),
    kPct: shrinkTowardAverage(rawKPct, LEAGUE_AVG_K_PCT, battersFaced, kStabilization),
    usedFallback: false,
  }
}

async function fetchTeamObp(teamId, season, date, taperMode = 'info') {
  const url = `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=hitting&season=${season}`
  let data
  try {
    data = await fetchJson(url)
  } catch {
    return LEAGUE_AVG_OBP
  }
  const stat = data.stats?.[0]?.splits?.[0]?.stat
  if (!stat?.obp) return LEAGUE_AVG_OBP
  const plateAppearances = stat.plateAppearances ?? ((stat.atBats ?? 0) + (stat.baseOnBalls ?? 0) + (stat.hitByPitch ?? 0) + (stat.sacrificeFlies ?? 0))
  const stabilizationSample = getStabilizationSample(TEAM_OBP_STABILIZATION_PA, date, taperMode)
  return shrinkTowardAverage(Number.parseFloat(stat.obp), LEAGUE_AVG_OBP, plateAppearances, stabilizationSample)
}

function extractTopOfOrderObp(players, date, taperMode = 'info') {
  if (!players) return null

  const orderedHitters = Object.values(players)
    .filter(player => Boolean(player.battingOrder))
    .sort((left, right) => Number.parseInt(left.battingOrder ?? '0', 10) - Number.parseInt(right.battingOrder ?? '0', 10))
    .slice(0, 3)

  if (orderedHitters.length < 3) return null

  const stabilizationSample = getStabilizationSample(TOP_OF_ORDER_OBP_STABILIZATION_PA, date, taperMode)
  const obps = orderedHitters
    .map(player => {
      const batting = player.seasonStats?.batting
      const rawObp = Number.parseFloat(batting?.obp ?? '')
      const plateAppearances = batting?.plateAppearances ?? 0
      if (!Number.isFinite(rawObp)) return null
      return shrinkTowardAverage(rawObp, LEAGUE_AVG_OBP, plateAppearances, stabilizationSample)
    })
    .filter(value => value !== null)

  if (obps.length < 3) return null
  return obps.reduce((sum, value) => sum + value, 0) / obps.length
}

async function fetchLineupStats(gamePk, date, taperMode = 'info') {
  const data = await fetchJson(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`)
  const teams = data.liveData?.boxscore?.teams
  return {
    home: extractTopOfOrderObp(teams?.home?.players, date, taperMode),
    away: extractTopOfOrderObp(teams?.away?.players, date, taperMode),
  }
}

function summarizePredictions(predictions) {
  const avgPrediction = predictions.reduce((sum, row) => sum + row.prediction, 0) / predictions.length
  const actualRate = predictions.reduce((sum, row) => sum + row.actual, 0) / predictions.length
  const brierScore = predictions.reduce((sum, row) => sum + (row.prediction - row.actual) ** 2, 0) / predictions.length

  return {
    avgPrediction,
    actualRate,
    calibrationGap: avgPrediction - actualRate,
    brierScore,
  }
}

async function fetchWeather(venueId, gameTimeIso) {
  const stadium = STADIUMS[venueId]
  if (!stadium || stadium.weatherControlled) {
    return { tempF: 72, windSpeedMph: 0, windFromDegrees: 0 }
  }

  const gameDate = gameTimeIso.slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  const isHistoricalDate = gameDate < today
  const url = new URL(isHistoricalDate ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(stadium.lat))
  url.searchParams.set('longitude', String(stadium.lon))
  url.searchParams.set('hourly', 'temperature_2m,wind_speed_10m,wind_direction_10m')
  url.searchParams.set('temperature_unit', 'fahrenheit')
  url.searchParams.set('wind_speed_unit', 'mph')
  url.searchParams.set('timezone', 'auto')
  if (isHistoricalDate) {
    url.searchParams.set('start_date', gameDate)
    url.searchParams.set('end_date', gameDate)
  } else {
    url.searchParams.set('forecast_days', '2')
  }

  const data = await fetchJson(url.toString())
  const hours = data.hourly.time
  const gameMs = new Date(gameTimeIso).getTime()
  let closestIndex = 0
  let minDiff = Number.POSITIVE_INFINITY
  for (let index = 0; index < hours.length; index += 1) {
    const diff = Math.abs(new Date(hours[index]).getTime() - gameMs)
    if (diff < minDiff) {
      minDiff = diff
      closestIndex = index
    }
  }

  return {
    tempF: Math.round(data.hourly.temperature_2m[closestIndex]),
    windSpeedMph: Math.round(data.hourly.wind_speed_10m[closestIndex]),
    windFromDegrees: Math.round(data.hourly.wind_direction_10m[closestIndex]),
  }
}

async function fetchLinescore(gamePk) {
  const data = await fetchJson(`https://statsapi.mlb.com/api/v1/game/${gamePk}/linescore`)
  return data.innings?.[0] ?? null
}

function getActualYrfi(firstInning) {
  if (!firstInning) return null
  const awayRuns = firstInning.away?.runs
  const homeRuns = firstInning.home?.runs
  if (typeof awayRuns !== 'number' || typeof homeRuns !== 'number') return null
  return awayRuns > 0 || homeRuns > 0 ? 1 : 0
}

function formatPct(value) {
  return `${(value * 100).toFixed(1)}%`
}

function buildCheckpointPath(cacheDir, date) {
  return path.join(cacheDir, `${date}.json`)
}

async function ensureCacheDir(cacheDir) {
  await mkdir(cacheDir, { recursive: true })
}

async function readCheckpoint(cacheDir, date) {
  try {
    const raw = await readFile(buildCheckpointPath(cacheDir, date), 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function writeCheckpoint(cacheDir, date, payload) {
  await writeFile(buildCheckpointPath(cacheDir, date), JSON.stringify(payload), 'utf8')
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = []
  let index = 0
  async function worker() {
    while (index < items.length) {
      const currentIndex = index
      index += 1
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
      if (RESPONSE_DELAY_MS > 0) {
        await new Promise(resolve => setTimeout(resolve, RESPONSE_DELAY_MS))
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

async function run() {
  const args = process.argv.slice(2)
  const compareMode = args.includes('--compare')
  const compareTapersMode = args.includes('--compare-tapers')
  const resumeMode = !args.includes('--no-resume')
  const positionalArgs = args.filter(arg => arg !== '--compare')
    .filter(arg => arg !== '--compare-tapers')
    .filter(arg => arg !== '--no-resume')
  const [startArg, endArg] = positionalArgs
  if (!startArg || !endArg) {
    console.error('Usage: npm run backtest -- YYYY-MM-DD YYYY-MM-DD [--compare] [--compare-tapers] [--no-resume]')
    process.exit(1)
  }

  const runMode = compareTapersMode ? 'compare-tapers' : compareMode ? 'compare' : 'single'
  const cacheDir = path.join(process.cwd(), '.backtest-cache', BACKTEST_CACHE_VERSION, `${startArg}_${endArg}_${runMode}`)
  if (resumeMode) {
    await ensureCacheDir(cacheDir)
  }

  const dates = dateRange(startArg, endArg)
  const savantStores = new Map()
  const pitcherCache = new Map()
  const teamCache = new Map()
  const weatherCache = new Map()
  const lineupCache = new Map()
  const predictions = []
  const legacyPredictions = []
  const infoPredictions = []

  for (const date of dates) {
    console.log(`Backtesting ${date}...`)

    if (resumeMode) {
      const cached = await readCheckpoint(cacheDir, date)
      if (cached) {
        predictions.push(...(cached.predictions ?? []))
        legacyPredictions.push(...(cached.legacyPredictions ?? []))
        infoPredictions.push(...(cached.infoPredictions ?? []))
        console.log(`Resumed ${date} from checkpoint.`)
        continue
      }
    }

    const season = Number.parseInt(date.slice(0, 4), 10)
    if (!savantStores.has(season)) {
      savantStores.set(season, await loadSavantStore(season))
    }
    const savantStore = savantStores.get(season)
    const games = await fetchSchedule(date)
    const datePredictions = []
    const dateLegacyPredictions = []
    const dateInfoPredictions = []

    await mapWithConcurrency(games, 4, async game => {
      const homePitcherId = game.teams.home.probablePitcher?.id
      const awayPitcherId = game.teams.away.probablePitcher?.id
      if (!homePitcherId || !awayPitcherId) return

      const pitcherIds = [homePitcherId, awayPitcherId]
      for (const pitcherId of pitcherIds) {
        const key = `${season}:${pitcherId}:current`
        if (!pitcherCache.has(key)) {
          pitcherCache.set(key, await fetchPitcherStats(pitcherId, season, date, 'linear'))
        }
        if (compareMode) {
          const legacyKey = `${season}:${pitcherId}:legacy`
          if (!pitcherCache.has(legacyKey)) {
            pitcherCache.set(legacyKey, await fetchPitcherStats(pitcherId, season, date, 'legacy'))
          }
        }
        if (compareTapersMode) {
          const infoKey = `${season}:${pitcherId}:info`
          if (!pitcherCache.has(infoKey)) {
            pitcherCache.set(infoKey, await fetchPitcherStats(pitcherId, season, date, 'info'))
          }
        }
      }

      const teamIds = [game.teams.home.team.id, game.teams.away.team.id]
      for (const teamId of teamIds) {
        const key = `${season}:${teamId}:current`
        if (!teamCache.has(key)) {
          teamCache.set(key, await fetchTeamObp(teamId, season, date, 'linear'))
        }
        if (compareMode) {
          const legacyKey = `${season}:${teamId}:legacy`
          if (!teamCache.has(legacyKey)) {
            teamCache.set(legacyKey, await fetchTeamObp(teamId, season, date, 'legacy'))
          }
        }
        if (compareTapersMode) {
          const infoKey = `${season}:${teamId}:info`
          if (!teamCache.has(infoKey)) {
            teamCache.set(infoKey, await fetchTeamObp(teamId, season, date, 'info'))
          }
        }
      }

      const weatherKey = `${game.venue.id}:${game.gameDate}`
      if (!weatherCache.has(weatherKey)) {
        weatherCache.set(weatherKey, await fetchWeather(game.venue.id, game.gameDate))
      }
      if (!lineupCache.has(game.gamePk)) {
        lineupCache.set(game.gamePk, {
          linear: await fetchLineupStats(game.gamePk, date, 'linear'),
          info: compareTapersMode ? await fetchLineupStats(game.gamePk, date, 'info') : null,
        })
      }

      const homePitcher = pitcherCache.get(`${season}:${homePitcherId}:current`)
      const awayPitcher = pitcherCache.get(`${season}:${awayPitcherId}:current`)
      const homeObp = teamCache.get(`${season}:${game.teams.home.team.id}:current`)
      const awayObp = teamCache.get(`${season}:${game.teams.away.team.id}:current`)
      const weather = weatherCache.get(weatherKey)
      const lineup = lineupCache.get(game.gamePk)
      const stadium = STADIUMS[game.venue.id] ?? { outfieldFacingDegrees: 0 }

      const lambdaHome = computeLambda({
        pitcherFip: awayPitcher.fip,
        pitcherKPct: awayPitcher.kPct,
        pitcherBarrelRate: getSavantStats(awayPitcherId, savantStore, date, 'linear').barrelRate,
        teamOBP: homeObp,
        topOfOrderOBP: lineup?.linear?.home ?? undefined,
        parkFactor: getParkFactor(game.venue.id),
        tempF: weather.tempF,
        windSpeedMph: weather.windSpeedMph,
        windFromDegrees: weather.windFromDegrees,
        outfieldFacingDegrees: stadium.outfieldFacingDegrees,
      })

      const lambdaAway = computeLambda({
        pitcherFip: homePitcher.fip,
        pitcherKPct: homePitcher.kPct,
        pitcherBarrelRate: getSavantStats(homePitcherId, savantStore, date, 'linear').barrelRate,
        teamOBP: awayObp,
        topOfOrderOBP: lineup?.linear?.away ?? undefined,
        parkFactor: getParkFactor(game.venue.id),
        tempF: weather.tempF,
        windSpeedMph: weather.windSpeedMph,
        windFromDegrees: weather.windFromDegrees,
        outfieldFacingDegrees: stadium.outfieldFacingDegrees,
      })

      const actual = getActualYrfi(await fetchLinescore(game.gamePk))
      if (actual === null) return

      const predictionRow = {
        date,
        prediction: computeYrfiProbability(lambdaHome, lambdaAway),
        actual,
      }
      predictions.push(predictionRow)
      datePredictions.push(predictionRow)

      if (compareMode) {
        const legacyHomePitcher = pitcherCache.get(`${season}:${homePitcherId}:legacy`)
        const legacyAwayPitcher = pitcherCache.get(`${season}:${awayPitcherId}:legacy`)
        const legacyHomeObp = teamCache.get(`${season}:${game.teams.home.team.id}:legacy`)
        const legacyAwayObp = teamCache.get(`${season}:${game.teams.away.team.id}:legacy`)

        const legacyLambdaHome = computeLambdaLegacy({
          pitcherFip: legacyAwayPitcher.fip,
          pitcherKPct: legacyAwayPitcher.kPct,
          pitcherBarrelRate: getSavantStats(awayPitcherId, savantStore, date, 'legacy').barrelRate,
          teamOBP: legacyHomeObp,
          parkFactor: getParkFactor(game.venue.id),
          tempF: weather.tempF,
          windSpeedMph: weather.windSpeedMph,
          windFromDegrees: weather.windFromDegrees,
          outfieldFacingDegrees: stadium.outfieldFacingDegrees,
        })

        const legacyLambdaAway = computeLambdaLegacy({
          pitcherFip: legacyHomePitcher.fip,
          pitcherKPct: legacyHomePitcher.kPct,
          pitcherBarrelRate: getSavantStats(homePitcherId, savantStore, date, 'legacy').barrelRate,
          teamOBP: legacyAwayObp,
          parkFactor: getParkFactor(game.venue.id),
          tempF: weather.tempF,
          windSpeedMph: weather.windSpeedMph,
          windFromDegrees: weather.windFromDegrees,
          outfieldFacingDegrees: stadium.outfieldFacingDegrees,
        })

        const legacyPredictionRow = {
          date,
          prediction: computeYrfiProbability(legacyLambdaHome, legacyLambdaAway),
          actual,
        }
        legacyPredictions.push(legacyPredictionRow)
        dateLegacyPredictions.push(legacyPredictionRow)
      }

      if (compareTapersMode) {
        const infoHomePitcher = pitcherCache.get(`${season}:${homePitcherId}:info`)
        const infoAwayPitcher = pitcherCache.get(`${season}:${awayPitcherId}:info`)
        const infoHomeObp = teamCache.get(`${season}:${game.teams.home.team.id}:info`)
        const infoAwayObp = teamCache.get(`${season}:${game.teams.away.team.id}:info`)

        const infoLambdaHome = computeLambda({
          pitcherFip: infoAwayPitcher.fip,
          pitcherKPct: infoAwayPitcher.kPct,
          pitcherBarrelRate: getSavantStats(awayPitcherId, savantStore, date, 'info').barrelRate,
          teamOBP: infoHomeObp,
          topOfOrderOBP: lineup?.info?.home ?? undefined,
          parkFactor: getParkFactor(game.venue.id),
          tempF: weather.tempF,
          windSpeedMph: weather.windSpeedMph,
          windFromDegrees: weather.windFromDegrees,
          outfieldFacingDegrees: stadium.outfieldFacingDegrees,
        })

        const infoLambdaAway = computeLambda({
          pitcherFip: infoHomePitcher.fip,
          pitcherKPct: infoHomePitcher.kPct,
          pitcherBarrelRate: getSavantStats(homePitcherId, savantStore, date, 'info').barrelRate,
          teamOBP: infoAwayObp,
          topOfOrderOBP: lineup?.info?.away ?? undefined,
          parkFactor: getParkFactor(game.venue.id),
          tempF: weather.tempF,
          windSpeedMph: weather.windSpeedMph,
          windFromDegrees: weather.windFromDegrees,
          outfieldFacingDegrees: stadium.outfieldFacingDegrees,
        })

        const infoPredictionRow = {
          date,
          prediction: computeYrfiProbability(infoLambdaHome, infoLambdaAway),
          actual,
        }
        infoPredictions.push(infoPredictionRow)
        dateInfoPredictions.push(infoPredictionRow)
      }
    })

    if (resumeMode) {
      await writeCheckpoint(cacheDir, date, {
        predictions: datePredictions,
        legacyPredictions: dateLegacyPredictions,
        infoPredictions: dateInfoPredictions,
      })
    }
  }

  if (predictions.length === 0) {
    console.error('No completed games found in that range.')
    process.exit(1)
  }

  const { avgPrediction, actualRate, calibrationGap, brierScore } = summarizePredictions(predictions)

  console.log('')
  console.log(`Games: ${predictions.length}`)
  console.log(`Average predicted YRFI: ${formatPct(avgPrediction)}`)
  console.log(`Actual YRFI rate:      ${formatPct(actualRate)}`)
  console.log(`Calibration gap:       ${formatPct(calibrationGap)}`)
  console.log(`Brier score:           ${brierScore.toFixed(4)}`)
  console.log('')

  const bins = Array.from({ length: 5 }, (_, index) => ({
    min: index * 0.1 + 0.3,
    max: index === 4 ? 1.01 : index * 0.1 + 0.4,
  }))

  console.log('Calibration bins:')
  for (const bin of bins) {
    const rows = predictions.filter(row => row.prediction >= bin.min && row.prediction < bin.max)
    if (rows.length === 0) continue
    const predicted = rows.reduce((sum, row) => sum + row.prediction, 0) / rows.length
    const actual = rows.reduce((sum, row) => sum + row.actual, 0) / rows.length
    console.log(`  ${formatPct(bin.min)}-${formatPct(bin.max)}: n=${rows.length}, pred=${formatPct(predicted)}, actual=${formatPct(actual)}`)
  }

  if (compareMode && legacyPredictions.length > 0) {
    const { avgPrediction: legacyAvgPrediction, actualRate: legacyActualRate, calibrationGap: legacyCalibrationGap, brierScore: legacyBrierScore } = summarizePredictions(legacyPredictions)

    console.log('')
    console.log('Legacy comparison:')
    console.log(`Legacy average predicted YRFI: ${formatPct(legacyAvgPrediction)}`)
    console.log(`Legacy actual YRFI rate:      ${formatPct(legacyActualRate)}`)
    console.log(`Legacy calibration gap:       ${formatPct(legacyCalibrationGap)}`)
    console.log(`Legacy Brier score:           ${legacyBrierScore.toFixed(4)}`)
    console.log(`Brier delta (current-legacy): ${(brierScore - legacyBrierScore).toFixed(4)}`)
    console.log(`Calibration delta:            ${formatPct(calibrationGap - legacyCalibrationGap)}`)
  }

  if (compareTapersMode && infoPredictions.length > 0) {
    const { avgPrediction: infoAvgPrediction, actualRate: infoActualRate, calibrationGap: infoCalibrationGap, brierScore: infoBrierScore } = summarizePredictions(infoPredictions)

    console.log('')
    console.log('Information taper comparison:')
    console.log(`Information average predicted YRFI: ${formatPct(infoAvgPrediction)}`)
    console.log(`Information actual YRFI rate:      ${formatPct(infoActualRate)}`)
    console.log(`Information calibration gap:       ${formatPct(infoCalibrationGap)}`)
    console.log(`Information Brier score:           ${infoBrierScore.toFixed(4)}`)
    console.log(`Brier delta (linear-info):         ${(brierScore - infoBrierScore).toFixed(4)}`)
    console.log(`Calibration delta:                 ${formatPct(calibrationGap - infoCalibrationGap)}`)
  }
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})