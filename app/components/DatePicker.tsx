'use client'

interface DatePickerProps {
  date: string        // YYYY-MM-DD
  onChange: (date: string) => void
}

function getPacificToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}

export default function DatePicker({ date, onChange }: DatePickerProps) {
  const today = getPacificToday()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  return (
    <div className="flex gap-2 px-4 py-3">
      {[today, tomorrowStr].map(d => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            date === d
              ? 'bg-green-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {d === today ? 'Today' : 'Tomorrow'}
        </button>
      ))}
    </div>
  )
}
