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
  const buttonClass = 'min-h-12 flex-1 rounded-full px-5 py-2.5 text-sm font-medium transition-colors sm:min-h-0 sm:flex-none sm:px-4 sm:py-1.5'

  return (
    <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
      {[today, tomorrowStr].map(d => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`${buttonClass} ${
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
