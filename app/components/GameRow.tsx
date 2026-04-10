import type { GameResult } from '@/lib/types'
import { formatOdds } from '@/lib/poisson'

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function weatherDisplay(weather: GameResult['weather']): string {
  if (weather.failure) return '—'
  const speed = weather.windSpeedMph
  const wind = speed < 5 ? 'calm' : `${speed}mph`
  return `${weather.tempF}°F ${wind}`
}

function ResultBadge({ result }: { result: GameResult['firstInningResult'] }) {
  if (result === 'run') return <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">RUN ✓</span>
  if (result === 'no_run') return <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">NO</span>
  return null
}

export default function GameRow({ game }: GameRowProps) {
  const estimated = !game.homePitcher.confirmed || !game.awayPitcher.confirmed
  const pct = formatPct(game.yrfiProbability, estimated)
  const odds = formatOdds(game.breakEvenOdds, estimated)

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
      <td className="hidden px-4 py-3 text-sm text-slate-500 whitespace-nowrap sm:table-cell">{weatherDisplay(game.weather)}</td>
      {/* Time + Result */}
      <td className="px-4 py-3 text-right text-sm text-slate-500 whitespace-nowrap">
        <div className="flex items-center justify-end gap-2">
          <ResultBadge result={game.firstInningResult} />
          <span>{formatTime(game.gameTime)}</span>
        </div>
      </td>
    </tr>
  )
}
