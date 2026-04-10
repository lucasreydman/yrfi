import Papa from 'papaparse'
import type { SavantStats } from './types'
import { kvGet, kvSet } from './kv'
import {
  LEAGUE_AVG_BARREL_PCT,
  LEAGUE_AVG_HARD_HIT_PCT,
  SAVANT_STABILIZATION_IP,
  shrinkTowardAverage,
} from './poisson'

const KV_TTL_SECONDS = 12 * 60 * 60 // 12 hours

function savantKey(year: number): string {
  return `savant-pitchers:${year}`
}

function parseIP(formatted: string): number {
  const parts = formatted.split('.')
  return parseInt(parts[0], 10) + (parseInt(parts[1] ?? '0', 10)) / 3
}

export type SavantStore = Record<string, SavantStats>

export function parseSavantCsv(csv: string): SavantStore {
  const { data } = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true })
  const store: SavantStore = {}

  for (const row of data) {
    const ip = parseIP(row['p_formatted_ip'] ?? '0')

    const playerId = parseInt(row['player_id'], 10)
    if (isNaN(playerId)) continue

    store[String(playerId)] = {
      playerId,
      barrelRate: parseFloat(row['barrel_batted_rate'] ?? '0'),
      hardHitRate: parseFloat(row['hard_hit_percent'] ?? '0'),
      inningsPitched: ip,
    }
  }

  return store
}

export function getSavantStats(
  playerId: number,
  store: SavantStore
): Pick<SavantStats, 'barrelRate' | 'hardHitRate' | 'inningsPitched'> & { usedFallback: boolean } {
  const entry = store[String(playerId)]
  if (!entry) {
    return {
      barrelRate: LEAGUE_AVG_BARREL_PCT,
      hardHitRate: LEAGUE_AVG_HARD_HIT_PCT,
      inningsPitched: 0,
      usedFallback: true,
    }
  }

  return {
    barrelRate: shrinkTowardAverage(entry.barrelRate, LEAGUE_AVG_BARREL_PCT, entry.inningsPitched, SAVANT_STABILIZATION_IP),
    hardHitRate: shrinkTowardAverage(entry.hardHitRate, LEAGUE_AVG_HARD_HIT_PCT, entry.inningsPitched, SAVANT_STABILIZATION_IP),
    inningsPitched: entry.inningsPitched,
    usedFallback: false,
  }
}

async function fetchSavantCsv(year: number): Promise<string> {
  const url = `https://baseballsavant.mlb.com/leaderboard/statcast?type=pitcher&year=${year}&position=SP,RP&team=&min=1&csv=true`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Savant fetch failed: ${res.status}`)
  return res.text()
}

export async function loadSavantStore(year: number): Promise<SavantStore> {
  const cached = await kvGet<SavantStore>(savantKey(year))
  if (cached) return cached

  const csv = await fetchSavantCsv(year)
  const store = parseSavantCsv(csv)
  await kvSet(savantKey(year), store, KV_TTL_SECONDS)
  return store
}
