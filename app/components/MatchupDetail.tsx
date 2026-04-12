'use client'

import type { GameResult, BatterRow, PitcherStats } from '@/lib/types'
import { computeMatchupBreakdown, type FactorBadge, type HalfInningBreakdown } from '@/lib/model-breakdown'
import { getTeamDisplayName } from '@/lib/team-names'
import { useSettings } from '@/app/context/SettingsContext'
// ─── Factor badge chip ────────────────────────────────────────────────────────

function FactorChip({ badge }: { badge: FactorBadge }) {
  const isUp = badge.direction === 'up'
  const isDown = badge.direction === 'down'
  const chipClass = isUp
    ? 'bg-orange-50 text-orange-700 border-orange-200'
    : isDown
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-slate-50 text-slate-500 border-slate-200'
  const arrow = isUp ? '↑' : isDown ? '↓' : '→'

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono font-semibold tabular-nums ${chipClass}`}>
        {arrow} {badge.multiplier.toFixed(2)}×
      </span>
      <span className="font-medium text-slate-700">{badge.label}</span>
      <span className="text-slate-400">{badge.description}</span>
    </div>
  )
}

// ─── Pitcher card ─────────────────────────────────────────────────────────────

function PitcherCard({
  label,
  pitcher,
  factors,
  lambda,
}: {
  label: string
  pitcher: PitcherStats
  factors: FactorBadge[]
  lambda: number
}) {
  const statusLabel = !pitcher.confirmed
    ? 'TBD'
    : pitcher.estimated
      ? 'Estimated'
      : 'Confirmed'
  const statusClass = !pitcher.confirmed
    ? 'bg-slate-100 text-slate-400'
    : pitcher.estimated
      ? 'bg-yellow-50 text-yellow-700'
      : 'bg-green-50 text-green-700'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
          <div className="mt-0.5 text-sm font-semibold text-slate-800">{pitcher.name}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${statusClass}`}>
          {statusLabel}
        </span>
      </div>
      <div className="mb-3 grid grid-cols-4 gap-1 text-center">
        <Stat label="FIP" value={pitcher.fip.toFixed(2)} />
        <Stat label="K%" value={`${(pitcher.kPct * 100).toFixed(1)}%`} />
        <Stat label="Barrel%" value={`${pitcher.barrelRate.toFixed(1)}%`} />
        <Stat label="λ" value={lambda.toFixed(3)} />
      </div>
      <div className="space-y-1.5">
        {factors.map(f => <FactorChip key={f.label} badge={f} />)}
      </div>
    </div>
  )
}

// ─── Lineup card ──────────────────────────────────────────────────────────────

function LineupCard({
  label,
  confirmed,
  batters,
  factors,
  teamOBP,
}: {
  label: string
  confirmed: boolean
  batters: BatterRow[]
  factors: FactorBadge[]
  teamOBP: number
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${confirmed ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
          {confirmed ? 'Confirmed' : 'Estimated'}
        </span>
      </div>

      {confirmed && batters.length > 0 ? (
        <table className="mb-3 w-full text-xs">
          <thead>
            <tr className="text-left text-[0.6rem] font-semibold uppercase tracking-wider text-slate-400">
              <th className="pb-1 pr-2">#</th>
              <th className="pb-1 pr-2">Batter</th>
              <th className="pb-1 pr-2 text-right">OBP (adj)</th>
              <th className="pb-1 text-right">PA</th>
            </tr>
          </thead>
          <tbody>
            {batters.map(b => (
              <tr key={b.battingSlot} className="border-t border-slate-100">
                <td className="py-1 pr-2 tabular-nums text-slate-400">{b.battingSlot}</td>
                <td className="py-1 pr-2 font-medium text-slate-700">{b.name}</td>
                <td className="py-1 pr-2 text-right tabular-nums text-slate-600">{b.stabilizedObp.toFixed(3)}</td>
                <td className="py-1 text-right tabular-nums text-slate-400">{b.plateAppearances}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mb-3 text-xs text-slate-400">
          Lineup not yet posted — team season OBP ({teamOBP.toFixed(3)}) used
        </p>
      )}

      <div className="space-y-1.5">
        {factors.map(f => <FactorChip key={f.label} badge={f} />)}
      </div>
    </div>
  )
}

// ─── Half-inning section ──────────────────────────────────────────────────────

function HalfInningSection({
  pitcherLabel,
  lineupLabel,
  pitcher,
  breakdown,
  confirmed,
  batters,
  teamOBP,
}: {
  pitcherLabel: string
  lineupLabel: string
  pitcher: PitcherStats
  breakdown: HalfInningBreakdown
  confirmed: boolean
  batters: BatterRow[]
  teamOBP: number
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <PitcherCard
        label={pitcherLabel}
        pitcher={pitcher}
        factors={breakdown.pitcherFactors}
        lambda={breakdown.lambda}
      />
      <LineupCard
        label={lineupLabel}
        confirmed={confirmed}
        batters={batters}
        factors={breakdown.lineupFactors}
        teamOBP={teamOBP}
      />
    </div>
  )
}

// ─── Park & weather section ───────────────────────────────────────────────────

function EnvSection({ game, envFactors }: { game: GameResult; envFactors: FactorBadge[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
          Park &amp; Weather
        </div>
        <span className="text-xs font-medium text-slate-600">{game.venue}</span>
      </div>
      <div className="space-y-1.5">
        {envFactors.map(f => <FactorChip key={f.label} badge={f} />)}
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function MatchupDetail({ game }: { game: GameResult }) {
  const { settings } = useSettings()
  const breakdown = computeMatchupBreakdown(game, settings)
  const awayTeam = getTeamDisplayName(game.awayTeam)
  const homeTeam = getTeamDisplayName(game.homeTeam)

  return (
    <div className="space-y-3 text-sm">
      {/* Away team bats (home pitcher vs away lineup) */}
      <SectionHeader label={`${awayTeam} batting`} />
      <HalfInningSection
        pitcherLabel="Home SP"
        lineupLabel={`${awayTeam} lineup`}
        pitcher={game.homePitcher}
        breakdown={breakdown.awayBats}
        confirmed={game.lineupDetails.away.length > 0}
        batters={game.lineupDetails.away}
        teamOBP={game.awayOBP}
      />

      {/* Home team bats (away pitcher vs home lineup) */}
      <SectionHeader label={`${homeTeam} batting`} />
      <HalfInningSection
        pitcherLabel="Away SP"
        lineupLabel={`${homeTeam} lineup`}
        pitcher={game.awayPitcher}
        breakdown={breakdown.homeBats}
        confirmed={game.lineupDetails.home.length > 0}
        batters={game.lineupDetails.home}
        teamOBP={game.homeOBP}
      />

      {/* Park & weather (shared by both half-innings) */}
      <EnvSection game={game} envFactors={breakdown.homeBats.envFactors} />
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 text-xs font-semibold tabular-nums text-slate-700">{value}</div>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="text-[0.7rem] font-semibold uppercase tracking-widest text-slate-400">{label}</div>
  )
}
