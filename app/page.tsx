import ClientShell from './components/ClientShell'
import { SITE_NAME } from '@/lib/site'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto max-w-7xl flex items-baseline gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-green-600">{SITE_NAME}</h1>
          <span className="hidden text-sm text-slate-400 sm:block">MLB first inning betting edge</span>
        </div>
      </header>
      <ClientShell />
    </main>
  )
}
