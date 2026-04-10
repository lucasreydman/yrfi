'use client'

import { useCallback, useEffect, useState } from 'react'
import type { GamesResponse } from '@/lib/types'
import GameTable from './GameTable'
import StatusBar from './StatusBar'
import DatePicker from './DatePicker'
import LoadingSkeleton from './LoadingSkeleton'
import MethodologyView from './MethodologyView'
import ConfigPanel from './ConfigPanel'
import { SettingsProvider } from '@/app/context/SettingsContext'

function getPacificToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}

type Tab = 'games' | 'methodology'

export default function ClientShell() {
  const [tab, setTab] = useState<Tab>('games')
  const [date, setDate] = useState(getPacificToday)
  const [data, setData] = useState<GamesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, setTick] = useState(0) // for 60s re-render timer

  const fetchData = useCallback(async (d: string, silent = false, force = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const search = new URLSearchParams({ date: d })
      if (force) search.set('force', '1')

      const res = await fetch(`/api/games?${search.toString()}`, {
        cache: force ? 'no-store' : 'default',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to load')
      }
      const json: GamesResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Fetch on mount and date change
  useEffect(() => {
    fetchData(date)
  }, [date, fetchData])

  // Re-fetch timer: every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => fetchData(date, true), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [date, fetchData])

  // Re-render timer: every 60 seconds (UI clock update only)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  const upcoming = data?.games.filter(g => g.gameStatus === 'upcoming') ?? []
  const inProgress = data?.games.filter(g => g.gameStatus === 'inProgress' && g.firstInningResult === 'pending') ?? []
  const settled = data?.games.filter(g => g.gameStatus === 'settled' || (g.gameStatus === 'inProgress' && g.firstInningResult !== 'pending')) ?? []

  return (
    <SettingsProvider>
    <div className="mx-auto max-w-7xl">
      {/* Nav bar: date tabs + right-side actions */}
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0">
        <div className="flex min-w-0 flex-1 gap-2">
          {tab === 'games' ? (
            <DatePicker date={date} onChange={d => { setDate(d); setData(null) }} />
          ) : (
            <button
              type="button"
              onClick={() => setTab('games')}
              className="min-h-12 rounded-full bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 sm:min-h-0 sm:px-4 sm:py-1.5"
            >
              ← Back to games
            </button>
          )}
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:justify-end">
          {tab === 'games' && <ConfigPanel />}
          <button
            type="button"
            onClick={() => setTab(tab === 'methodology' ? 'games' : 'methodology')}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors sm:min-h-0 sm:px-3 sm:py-1.5 ${
              tab === 'methodology'
                ? 'bg-green-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span className="sm:hidden">Model</span>
            <span className="hidden sm:inline">Methodology</span>
          </button>
        </div>
      </div>

      {/* Methodology tab */}
      {tab === 'methodology' && <MethodologyView />}

      {/* Games tab */}
      {tab === 'games' && (
        <>
          {data && (
            <StatusBar
              generatedAt={data.generatedAt}
              gameCount={data.games.length}
              onRefresh={() => fetchData(date, true, true)}
              refreshing={refreshing}
            />
          )}

          {loading && <LoadingSkeleton />}

          {error && (
            <div className="mx-4 mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-medium">Failed to load games</p>
              <p className="mt-1 text-red-600">{error}</p>
              <button
                onClick={() => fetchData(date)}
                type="button"
                className="mt-3 rounded bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <div className="px-4 py-6">
              {data.games.length === 0 && (
                <p className="text-center text-slate-400">No games scheduled for this date.</p>
              )}
              <GameTable games={upcoming} label="Upcoming" />
              <GameTable games={inProgress} label="In Progress" />
              <GameTable games={settled} label="Settled" />
            </div>
          )}
        </>
      )}
    </div>
    </SettingsProvider>
  )
}
