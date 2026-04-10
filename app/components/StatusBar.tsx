'use client'

interface StatusBarProps {
  generatedAt: string
  gameCount: number
  onRefresh: () => void
  refreshing: boolean
}

export default function StatusBar({ generatedAt, gameCount, onRefresh, refreshing }: StatusBarProps) {
  const updated = new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-sm text-slate-500">
      <div className="flex items-center gap-3">
        <span>Updated {updated}</span>
        <span className="hidden sm:inline">·</span>
        <span className="hidden sm:inline">{gameCount} game{gameCount !== 1 ? 's' : ''}</span>
      </div>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50"
      >
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  )
}
