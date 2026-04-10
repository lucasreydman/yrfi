'use client'

import type { GameResult } from '@/lib/types'
import { useSettings, resolveTimezone } from '@/app/context/SettingsContext'
import { getTeamDisplayName } from '@/lib/team-names'
import { getYrfiTextClass } from '@/lib/yrfi-color'

interface GameRowProps {
  game: GameResult
}

function formatPct(p: number, showEstimatePrefix: boolean): string {
  return `${showEstimatePrefix ? '~' : ''}${(p * 100).toFixed(1)}%`
}

function formatTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  })
}

function formatOddsDisplay(
  american: number,
  format: 'american' | 'decimal',
): string {
  if (format === 'decimal') {
    const decimal = american > 0
      ? (american / 100) + 1
      : (100 / Math.abs(american)) + 1
    return `${decimal.toFixed(2)} or better`
  }
  const display = american === -100 ? '+100' : american > 0 ? `+${american}` : `${american}`
  return `${display} or better`
}

function formatTemp(weather: GameResult['weather'], tempUnit: 'F' | 'C'): string {
  if (weather.controlled) return 'Roof'
  if (weather.failure) return '—'
  return tempUnit === 'C'
    ? `${Math.round((weather.tempF - 32) * 5 / 9)}°C`
    : `${weather.tempF}°F`
}

function formatWind(weather: GameResult['weather'], windUnit: 'mph' | 'kmh'): string {
  if (weather.controlled) return 'Roof'
  if (weather.failure) return '—'
  if (weather.windSpeedMph < 5) return 'Calm'
  return windUnit === 'kmh'
    ? `${Math.round(weather.windSpeedMph * 1.60934)} km/h`
    : `${weather.windSpeedMph} mph`
}

function ResultBadge({ game }: { game: GameResult }) {
  if (game.firstInningResult === 'run') {
    return <span className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">RUN</span>
  }
  if (game.firstInningResult === 'no_run') {
    return <span className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">NO RUN</span>
  }
  if (game.gameStatus === 'inProgress') {
    return <span className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">IP</span>
  }
  return <span className="inline-flex w-full justify-center text-slate-300">—</span>
}

function LimitedDataBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
      Limited data
    </span>
  )
}

function PitcherName({ pitcher }: { pitcher: GameResult['homePitcher'] }) {
  const showLimitedData = pitcher.confirmed && pitcher.estimated

  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="block max-w-full truncate whitespace-nowrap">{pitcher.name}</span>
      {showLimitedData ? <LimitedDataBadge /> : null}
    </span>
  )
}

export default function GameRow({ game }: GameRowProps) {
  const { settings } = useSettings()
  const showEstimatePrefix = !game.homePitcher.confirmed || !game.awayPitcher.confirmed
  const awayTeam = getTeamDisplayName(game.awayTeam)
  const homeTeam = getTeamDisplayName(game.homeTeam)
  const pct = formatPct(game.yrfiProbability, showEstimatePrefix)
  const odds = showEstimatePrefix ? '—' : formatOddsDisplay(game.breakEvenOdds, settings.oddsFormat)
  const temp = formatTemp(game.weather, settings.tempUnit)
  const wind = formatWind(game.weather, settings.windUnit)
  const time = formatTime(game.gameTime, resolveTimezone(settings.timezone))
  const yrfiColorClass = getYrfiTextClass(game.yrfiProbability)

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      {/* Matchup — truncate prevents overflow */}
      <td className="px-4 py-3 align-middle font-medium">
        <span className="flex min-w-0 items-center gap-1 whitespace-nowrap">
          <span className="truncate text-slate-500">{awayTeam}</span>
          <span className="shrink-0 text-slate-300">@</span>
          <span className="truncate">{homeTeam}</span>
        </span>
      </td>
      {/* Away SP */}
      <td className="px-4 py-3 align-middle text-sm text-slate-600">
        <PitcherName pitcher={game.awayPitcher} />
      </td>
      {/* Home SP */}
      <td className="px-4 py-3 align-middle text-sm text-slate-600">
        <PitcherName pitcher={game.homePitcher} />
      </td>
      {/* YRFI % */}
      <td className={`px-4 py-3 align-middle whitespace-nowrap tabular-nums font-semibold ${yrfiColorClass}`}>
        {pct}
      </td>
      {/* Bet at */}
      <td className={`px-4 py-3 align-middle whitespace-nowrap text-center text-sm tabular-nums ${showEstimatePrefix ? 'text-slate-300' : 'font-medium text-slate-700'}`}>
        {odds}
      </td>
      {/* Temp */}
      <td className="px-3 py-3 align-middle whitespace-nowrap text-center text-sm text-slate-500">{temp}</td>
      {/* Wind */}
      <td className="px-3 py-3 align-middle whitespace-nowrap text-center text-sm text-slate-500">{wind}</td>
      {/* Time */}
      <td className="px-3 py-3 align-middle whitespace-nowrap text-center text-sm text-slate-500">{time}</td>
      {/* Result */}
      <td className="px-2.5 py-3 align-middle whitespace-nowrap text-center">
        <ResultBadge game={game} />
      </td>
    </tr>
  )
}
