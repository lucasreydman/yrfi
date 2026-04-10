import type { GameResult } from '@/lib/types'
import GameRow from './GameRow'
import { formatOdds } from '@/lib/poisson'

interface GameTableProps {
  games: GameResult[]
  label: string
}

function MobileCard({ game }: { game: GameResult }) {
  const estimated = !game.homePitcher.confirmed || !game.awayPitcher.confirmed
  const pct = `${estimated ? '~' : ''}${Math.round(game.yrfiProbability * 100)}%`
  const odds = formatOdds(game.breakEvenOdds, estimated)
  const time = new Date(game.gameTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  const yrfiColor = game.yrfiProbability >= 0.55
    ? 'text-green-700' : game.yrfiProbability >= 0.45
    ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="border-b border-slate-100 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">
          <span className="text-slate-500">{game.awayTeam}</span>
          <span className="mx-1 text-slate-300">@</span>
          <span>{game.homeTeam}</span>
        </div>
        <div className={`text-lg font-bold tabular-nums ${yrfiColor}`}>{pct}</div>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm text-slate-500">
        <span>{game.awayPitcher.name} vs {game.homePitcher.name}</span>
        <span className="font-medium text-slate-700">{odds}</span>
      </div>
      <div className="mt-0.5 text-xs text-slate-400">{time}</div>
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
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3 w-[220px] whitespace-nowrap">Matchup</th>
              <th className="px-4 py-3 w-[150px] whitespace-nowrap">Away SP</th>
              <th className="px-4 py-3 w-[150px] whitespace-nowrap">Home SP</th>
              <th className="px-4 py-3 w-[80px] whitespace-nowrap">YRFI %</th>
              <th className="px-4 py-3 w-[160px] whitespace-nowrap">Bet at</th>
              <th className="px-4 py-3 w-[110px] whitespace-nowrap">Weather</th>
              <th className="px-4 py-3 w-[130px] whitespace-nowrap text-right">Time</th>
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
