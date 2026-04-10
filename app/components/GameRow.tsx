import type { GameResult } from '@/lib/types'
import { useSettings } from '@/app/context/SettingsContext'

interface GameRowProps {
  game: GameResult
}

function yrfiColor(pct: number): string {
  if (pct >= 0.55) return 'text-green-700 font-semibold'
  if (pct >= 0.45) return 'text-yellow-600 font-semibold'
  return 'text-red-600 font-semibold'
}

function formatPct(p: number, estimated: boolean): string {
  return `${estimated ? '~' : ''}${Math.round(p * 100)}%`
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
  estimated: boolean,
  format: 'american' | 'decimal',
): string {
  const prefix = estimated ? '~' : ''
  if (format === 'decimal') {
    const decimal = american > 0
      ? (american / 100) + 1
      : (100 / Math.abs(american)) + 1
    return `${prefix}${decimal.toFixed(2)} or better`
  }
  const display = american === -100 ? '+100' : american > 0 ? `+${american}` : `${american}`
  return `${prefix}${display} or better`
}

function formatWeather(
  weather: GameResult['weather'],
  tempUnit: 'F' | 'C',
  windUnit: 'mph' | 'kmh',
): string {
  if (weather.failure) return '—'
  const temp = tempUnit === 'C'
    ? `${Math.round((weather.tempF - 32) * 5 / 9)}°C`
    : `${weather.tempF}°F`
  const speed = windUnit === 'kmh'
    ? Math.round(weather.windSpeedMph * 1.60934)
    : weather.windSpeedMph
  const speedLabel = windUnit === 'kmh' ? 'km/h' : 'mph'
  const wind = weather.windSpeedMph < 5 ? 'calm' : `${speed}${speedLabel}`
  return `${temp} ${wind}`
}

function ResultBadge({ result }: { result: GameResult['firstInningResult'] }) {
  if (result === 'run') return <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">RUN ✓</span>
  if (result === 'no_run') return <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">NO</span>
  return null
}

export default function GameRow({ game }: GameRowProps) {
  const { settings } = useSettings()
  const estimated = !game.homePitcher.confirmed || !game.awayPitcher.confirmed
  const pct = formatPct(game.yrfiProbability, estimated)
  const odds = formatOddsDisplay(game.breakEvenOdds, estimated, settings.oddsFormat)
  const weather = formatWeather(game.weather, settings.tempUnit, settings.windUnit)
  const time = formatTime(game.gameTime, settings.timezone)

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      {/* Matchup */}
      <td className="px-4 py-3 font-medium whitespace-nowrap">
        <span className="text-slate-500">{game.awayTeam}</span>
        <span className="mx-1 text-slate-300">@</span>
        <span>{game.homeTeam}</span>
      </td>
      {/* Away SP */}
      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{game.awayPitcher.name}</td>
      {/* Home SP */}
      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{game.homePitcher.name}</td>
      {/* YRFI % */}
      <td className={`px-4 py-3 tabular-nums whitespace-nowrap ${yrfiColor(game.yrfiProbability)}`}>{pct}</td>
      {/* Bet at */}
      <td className="px-4 py-3 text-sm font-medium text-slate-700 tabular-nums whitespace-nowrap">{odds}</td>
      {/* Weather */}
      <td className="hidden px-4 py-3 text-sm text-slate-500 whitespace-nowrap sm:table-cell">{weather}</td>
      {/* Time + Result */}
      <td className="px-4 py-3 text-right text-sm text-slate-500 whitespace-nowrap">
        <div className="flex items-center justify-end gap-2">
          <ResultBadge result={game.firstInningResult} />
          <span>{time}</span>
        </div>
      </td>
    </tr>
  )
}
