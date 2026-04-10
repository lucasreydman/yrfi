'use client'

import type { GameResult } from '@/lib/types'
import GameRow from './GameRow'
import { useSettings, resolveTimezone } from '@/app/context/SettingsContext'
import { getTeamDisplayName } from '@/lib/team-names'

interface GameTableProps {
  games: GameResult[]
  label: string
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

function MobileResultBadge({ game }: { game: GameResult }) {
  if (game.firstInningResult === 'run') {
    return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">RUN</span>
  }
  if (game.firstInningResult === 'no_run') {
    return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">NO RUN</span>
  }
  if (game.gameStatus === 'inProgress') {
    return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">IP</span>
  }
  return <span className="text-slate-300 text-sm">—</span>
}

function MobileCard({ game }: { game: GameResult }) {
  const { settings } = useSettings()
  const estimated = !game.homePitcher.confirmed || !game.awayPitcher.confirmed
  const awayTeam = getTeamDisplayName(game.awayTeam)
  const homeTeam = getTeamDisplayName(game.homeTeam)
  const pct = `${estimated ? '~' : ''}${Math.round(game.yrfiProbability * 100)}%`
  const odds = formatOddsDisplay(game.breakEvenOdds, estimated, settings.oddsFormat)
  const time = new Date(game.gameTime).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: resolveTimezone(settings.timezone),
  })

  const yrfiColor = game.yrfiProbability >= 0.55
    ? 'text-green-700' : game.yrfiProbability >= 0.45
    ? 'text-yellow-600' : 'text-red-600'

  const tempStr = game.weather.failure ? '—' : settings.tempUnit === 'C'
    ? `${Math.round((game.weather.tempF - 32) * 5 / 9)}°C`
    : `${game.weather.tempF}°F`

  const windStr = game.weather.failure ? '—' : game.weather.windSpeedMph < 5 ? 'Calm'
    : settings.windUnit === 'kmh'
      ? `${Math.round(game.weather.windSpeedMph * 1.60934)} km/h`
      : `${game.weather.windSpeedMph} mph`

  return (
    <div className="border-b border-slate-100 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">
          <span className="text-slate-500">{awayTeam}</span>
          <span className="mx-1 text-slate-300">@</span>
          <span>{homeTeam}</span>
        </div>
        <div className="flex items-center gap-2">
          <MobileResultBadge game={game} />
          <div className={`text-lg font-bold tabular-nums ${yrfiColor}`}>{pct}</div>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm text-slate-500">
        <span>{game.awayPitcher.name} vs {game.homePitcher.name}</span>
        <span className="font-medium text-slate-700">{odds}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
        <span>{time}</span>
        <span className="text-slate-200">·</span>
        <span>{tempStr}</span>
        <span className="text-slate-200">·</span>
        <span>{windStr}</span>
      </div>
    </div>
  )
}

export default function GameTable({ games, label }: GameTableProps) {
  if (games.length === 0) return null

  return (
    <section className="mb-8">
      <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</h2>

      {/* Mobile card list */}
      <div className="sm:hidden rounded-xl border border-slate-200 bg-white overflow-hidden">
        {games.map(g => <MobileCard key={g.gamePk} game={g} />)}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-[1080px] w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[212px]" />
            <col className="w-[152px]" />
            <col className="w-[152px]" />
            <col className="w-[84px]" />
            <col className="w-[164px]" />
            <col className="w-[68px]" />
            <col className="w-[80px]" />
            <col className="w-[76px]" />
            <col className="w-[92px]" />
          </colgroup>
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3 whitespace-nowrap">Matchup</th>
              <th className="px-4 py-3 whitespace-nowrap">Away SP</th>
              <th className="px-4 py-3 whitespace-nowrap">Home SP</th>
              <th className="px-4 py-3 whitespace-nowrap">YRFI %</th>
              <th className="px-4 py-3 whitespace-nowrap">Bet at</th>
              <th className="px-3 py-3 whitespace-nowrap text-center">Temp</th>
              <th className="px-3 py-3 whitespace-nowrap text-center">Wind</th>
              <th className="px-3 py-3 whitespace-nowrap text-center">Time</th>
              <th className="px-2.5 py-3 whitespace-nowrap text-center">Result</th>
            </tr>
          </thead>
          <tbody>
            {games.map(g => <GameRow key={g.gamePk} game={g} />)}
          </tbody>
        </table>
      </div>
    </section>
  )
}
