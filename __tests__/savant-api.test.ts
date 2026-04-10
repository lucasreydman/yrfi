import { parseSavantCsv, getSavantStats } from '@/lib/savant-api'
import { LEAGUE_AVG_BARREL_PCT, LEAGUE_AVG_HARD_HIT_PCT } from '@/lib/poisson'

const SAMPLE_CSV = `player_id,player_name,barrel_batted_rate,hard_hit_percent,p_formatted_ip
123456,Cole Pitcher,10.5,45.2,120.1
789012,Bad Pitcher,15.0,52.0,55.0
999999,Few IP Guy,6.0,35.0,20.0`

describe('parseSavantCsv', () => {
  it('parses player_id, barrelRate, hardHitRate, and IP', () => {
    const result = parseSavantCsv(SAMPLE_CSV)
    expect(result['123456']).toEqual({
      playerId: 123456,
      barrelRate: 10.5,
      hardHitRate: 45.2,
      inningsPitched: expect.closeTo(120.33, 1),
    })
  })

  it('includes pitchers with large samples after parsing', () => {
    const result = parseSavantCsv(SAMPLE_CSV)
    expect(result['789012']).toBeDefined()
  })

  it('keeps low-IP pitchers so the model can shrink them instead of dropping them', () => {
    const result = parseSavantCsv(SAMPLE_CSV)
    expect(result['999999']).toBeDefined()
  })
})

describe('getSavantStats', () => {
  it('returns stats for a known pitcher ID', () => {
    const store = { '123456': { playerId: 123456, barrelRate: 10.5, hardHitRate: 45.2, inningsPitched: 120 } }
    const result = getSavantStats(123456, store)
    expect(result.barrelRate).toBeCloseTo(9.76, 2)
    expect(result.usedFallback).toBe(false)
  })

  it('returns league avg barrel rate for unknown pitcher', () => {
    const result = getSavantStats(0, {})
    expect(result.barrelRate).toBe(LEAGUE_AVG_BARREL_PCT)
    expect(result.hardHitRate).toBe(LEAGUE_AVG_HARD_HIT_PCT)
    expect(result.usedFallback).toBe(true)
  })

  it('shrinks low-sample Savant data toward league average', () => {
    const result = getSavantStats(789012, parseSavantCsv(SAMPLE_CSV))
    expect(result.barrelRate).toBeGreaterThan(LEAGUE_AVG_BARREL_PCT)
    expect(result.barrelRate).toBeLessThan(15)
  })
})
