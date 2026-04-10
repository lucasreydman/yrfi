'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export interface Settings {
  tempUnit: 'F' | 'C'
  windUnit: 'mph' | 'kmh'
  oddsFormat: 'american' | 'decimal'
  timezone: string
}

const DEFAULTS: Settings = {
  tempUnit: 'F',
  windUnit: 'mph',
  oddsFormat: 'american',
  timezone: 'America/New_York',
}

const SettingsContext = createContext<{
  settings: Settings
  update: (patch: Partial<Settings>) => void
}>({ settings: DEFAULTS, update: () => {} })

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('yrfi-settings')
      if (stored) setSettings({ ...DEFAULTS, ...JSON.parse(stored) })
    } catch {}
  }, [])

  function update(patch: Partial<Settings>) {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem('yrfi-settings', JSON.stringify(next)) } catch {}
      return next
    })
  }

  return (
    <SettingsContext.Provider value={{ settings, update }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}

export const TIMEZONES: { label: string; value: string }[] = [
  { label: 'Eastern (ET)',   value: 'America/New_York' },
  { label: 'Central (CT)',   value: 'America/Chicago' },
  { label: 'Mountain (MT)',  value: 'America/Denver' },
  { label: 'Pacific (PT)',   value: 'America/Los_Angeles' },
  { label: 'Alaska (AKT)',   value: 'America/Anchorage' },
  { label: 'Hawaii (HST)',   value: 'Pacific/Honolulu' },
  { label: 'London (GMT/BST)', value: 'Europe/London' },
  { label: 'Paris (CET/CEST)', value: 'Europe/Paris' },
  { label: 'Tokyo (JST)',    value: 'Asia/Tokyo' },
  { label: 'Sydney (AEST)',  value: 'Australia/Sydney' },
]
