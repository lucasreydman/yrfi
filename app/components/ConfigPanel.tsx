'use client'

import { useEffect, useRef, useState } from 'react'
import { useSettings, TIMEZONES } from '@/app/context/SettingsContext'

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function SegmentRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { label: string; value: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-medium text-slate-500">{label}</span>
      <div className="flex w-full overflow-hidden rounded-lg border border-slate-200 text-xs font-medium">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 whitespace-nowrap px-3 py-2 transition-colors ${
              value === opt.value
                ? 'bg-green-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ConfigPanel() {
  const { settings, update } = useSettings()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
          open
            ? 'bg-green-600 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
        aria-label="Preferences"
      >
        <GearIcon />
        <span className="sm:hidden">Prefs</span>
        <span className="hidden sm:inline">Preferences</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] max-h-[calc(100vh-6rem)] space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:w-64">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Preferences</p>

          <SegmentRow
            label="Temperature"
            options={[{ label: '°F', value: 'F' }, { label: '°C', value: 'C' }]}
            value={settings.tempUnit}
            onChange={v => update({ tempUnit: v as 'F' | 'C' })}
          />

          <SegmentRow
            label="Wind speed"
            options={[{ label: 'mph', value: 'mph' }, { label: 'km/h', value: 'kmh' }]}
            value={settings.windUnit}
            onChange={v => update({ windUnit: v as 'mph' | 'kmh' })}
          />

          <SegmentRow
            label="Odds format"
            options={[{ label: 'American', value: 'american' }, { label: 'Decimal', value: 'decimal' }]}
            value={settings.oddsFormat}
            onChange={v => update({ oddsFormat: v as 'american' | 'decimal' })}
          />

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-500">Time zone</span>
            <select
              aria-label="Time zone"
              value={settings.timezone}
              onChange={e => update({ timezone: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
