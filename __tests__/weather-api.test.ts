import { getStadiumConstants, fetchWeather } from '@/lib/weather-api'

describe('getStadiumConstants', () => {
  it('returns Fenway Park constants for venueId 3', () => {
    const stadium = getStadiumConstants(3)
    expect(stadium).not.toBeNull()
    expect(stadium!.name).toContain('Fenway')
    expect(stadium!.outfieldFacingDegrees).toBeDefined()
  })

  it('returns null for unknown venueId', () => {
    expect(getStadiumConstants(99999)).toBeNull()
  })

  it('has all 30 stadiums defined', () => {
    const { STADIUMS } = require('@/lib/weather-api')
    expect(Object.keys(STADIUMS).length).toBe(30)
  })
})
