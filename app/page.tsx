import ClientShell from './components/ClientShell'
import { SITE_NAME } from '@/lib/site'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-200 bg-white py-3 sm:py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 sm:flex-row sm:items-baseline sm:gap-3">
          <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
            <h1 className="text-[1.75rem] font-bold leading-none tracking-tight text-green-600 sm:text-[2rem]">{SITE_NAME}</h1>
            <span className="text-xs font-semibold tracking-tight text-green-500 sm:text-sm">.vercel.app</span>
          </div>
          <span className="max-w-xl text-xs leading-snug text-slate-400 sm:text-sm">
            Books shade extra vig into public NRFI prices, so why not hunt for EV on the other side?
          </span>
        </div>
      </header>
      <ClientShell />
    </main>
  )
}
