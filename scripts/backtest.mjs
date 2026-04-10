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
const RESPONSE_DELAY_MS = 0

const FIP_FACTOR_WEIGHT = 0.55
const BARREL_FACTOR_WEIGHT = 0.35
const OBP_FACTOR_WEIGHT = 0.7
const PARK_FACTOR_WEIGHT = 0.5
const WEATHER_FACTOR_WEIGHT = 0.5
const MIN_ADJUSTMENT_FACTOR = 0.55
const MAX_ADJUSTMENT_FACTOR = 1.55

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

function computeLambda({ pitcherFip, pitcherKPct, pitcherBarrelRate, teamOBP, parkFactor, tempF, windSpeedMph, windFromDegrees, outfieldFacingDegrees }) {
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
  return (data.dates?.[0]?.games ?? []).filter(game => !['Postponed', 'Cancelled', 'Suspended'].includes(game.status.detailedState))
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

function getSavantStats(playerId, store) {
  const entry = store.get(playerId)
  if (!entry) {
    return { barrelRate: LEAGUE_AVG_BARREL_PCT, hardHitRate: 38.0 }
  }
  return {
    barrelRate: shrinkTowardAverage(entry.barrelRate, LEAGUE_AVG_BARREL_PCT, entry.inningsPitched, SAVANT_STABILIZATION_IP),
    hardHitRate: shrinkTowardAverage(entry.hardHitRate, 38.0, entry.inningsPitched, SAVANT_STABILIZATION_IP),
  }
}

async function fetchPitcherStats(playerId, season) {
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
  return {
    fip: shrinkTowardAverage(rawFip, LEAGUE_AVG_FIP, inningsPitched, PITCHER_FIP_STABILIZATION_IP),
    kPct: shrinkTowardAverage(rawKPct, LEAGUE_AVG_K_PCT, battersFaced, PITCHER_K_STABILIZATION_BF),
    usedFallback: false,
  }
}

async function fetchTeamObp(teamId, season) {
  const url = `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=hitting&season=${season}`
  const data = await fetchJson(url)
  const stat = data.stats?.[0]?.splits?.[0]?.stat
  if (!stat?.obp) return LEAGUE_AVG_OBP
  const plateAppearances = stat.plateAppearances ?? ((stat.atBats ?? 0) + (stat.baseOnBalls ?? 0) + (stat.hitByPitch ?? 0) + (stat.sacrificeFlies ?? 0))
  return shrinkTowardAverage(Number.parseFloat(stat.obp), LEAGUE_AVG_OBP, plateAppearances, TEAM_OBP_STABILIZATION_PA)
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
  const [, , startArg, endArg] = process.argv
  if (!startArg || !endArg) {
    console.error('Usage: npm run backtest -- YYYY-MM-DD YYYY-MM-DD')
    process.exit(1)
  }

  const dates = dateRange(startArg, endArg)
  const savantStores = new Map()
  const pitcherCache = new Map()
  const teamCache = new Map()
  const weatherCache = new Map()
  const predictions = []

  for (const date of dates) {
    console.log(`Backtesting ${date}...`)
    const season = Number.parseInt(date.slice(0, 4), 10)
    if (!savantStores.has(season)) {
      savantStores.set(season, await loadSavantStore(season))
    }
    const savantStore = savantStores.get(season)
    const games = await fetchSchedule(date)

    await mapWithConcurrency(games, 4, async game => {
      const homePitcherId = game.teams.home.probablePitcher?.id
      const awayPitcherId = game.teams.away.probablePitcher?.id
      if (!homePitcherId || !awayPitcherId) return

      const pitcherIds = [homePitcherId, awayPitcherId]
      for (const pitcherId of pitcherIds) {
        const key = `${season}:${pitcherId}`
        if (!pitcherCache.has(key)) {
          pitcherCache.set(key, await fetchPitcherStats(pitcherId, season))
        }
      }

      const teamIds = [game.teams.home.team.id, game.teams.away.team.id]
      for (const teamId of teamIds) {
        const key = `${season}:${teamId}`
        if (!teamCache.has(key)) {
          teamCache.set(key, await fetchTeamObp(teamId, season))
        }
      }

      const weatherKey = `${game.venue.id}:${game.gameDate}`
      if (!weatherCache.has(weatherKey)) {
        weatherCache.set(weatherKey, await fetchWeather(game.venue.id, game.gameDate))
      }

      const homePitcher = pitcherCache.get(`${season}:${homePitcherId}`)
      const awayPitcher = pitcherCache.get(`${season}:${awayPitcherId}`)
      const homeObp = teamCache.get(`${season}:${game.teams.home.team.id}`)
      const awayObp = teamCache.get(`${season}:${game.teams.away.team.id}`)
      const weather = weatherCache.get(weatherKey)
      const stadium = STADIUMS[game.venue.id] ?? { outfieldFacingDegrees: 0 }

      const lambdaHome = computeLambda({
        pitcherFip: awayPitcher.fip,
        pitcherKPct: awayPitcher.kPct,
        pitcherBarrelRate: getSavantStats(awayPitcherId, savantStore).barrelRate,
        teamOBP: homeObp,
        parkFactor: getParkFactor(game.venue.id),
        tempF: weather.tempF,
        windSpeedMph: weather.windSpeedMph,
        windFromDegrees: weather.windFromDegrees,
        outfieldFacingDegrees: stadium.outfieldFacingDegrees,
      })

      const lambdaAway = computeLambda({
        pitcherFip: homePitcher.fip,
        pitcherKPct: homePitcher.kPct,
        pitcherBarrelRate: getSavantStats(homePitcherId, savantStore).barrelRate,
        teamOBP: awayObp,
        parkFactor: getParkFactor(game.venue.id),
        tempF: weather.tempF,
        windSpeedMph: weather.windSpeedMph,
        windFromDegrees: weather.windFromDegrees,
        outfieldFacingDegrees: stadium.outfieldFacingDegrees,
      })

      const actual = getActualYrfi(await fetchLinescore(game.gamePk))
      if (actual === null) return

      predictions.push({
        date,
        prediction: computeYrfiProbability(lambdaHome, lambdaAway),
        actual,
      })
    })
  }

  if (predictions.length === 0) {
    console.error('No completed games found in that range.')
    process.exit(1)
  }

  const avgPrediction = predictions.reduce((sum, row) => sum + row.prediction, 0) / predictions.length
  const actualRate = predictions.reduce((sum, row) => sum + row.actual, 0) / predictions.length
  const brierScore = predictions.reduce((sum, row) => sum + (row.prediction - row.actual) ** 2, 0) / predictions.length

  console.log('')
  console.log(`Games: ${predictions.length}`)
  console.log(`Average predicted YRFI: ${formatPct(avgPrediction)}`)
  console.log(`Actual YRFI rate:      ${formatPct(actualRate)}`)
  console.log(`Calibration gap:       ${formatPct(avgPrediction - actualRate)}`)
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
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})