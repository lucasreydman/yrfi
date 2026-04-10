import ClientShell from './components/ClientShell'
import { SITE_NAME } from '@/lib/site'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-200 bg-white py-4">
        <div className="mx-auto flex max-w-7xl items-baseline gap-3 px-4">
          <h1 className="text-2xl font-bold tracking-tight text-green-600">{SITE_NAME}</h1>
          <span className="hidden text-sm text-slate-400 sm:block">Books shade extra vig into public NRFI prices, so we hunt for EV on the other side.</span>
        </div>
      </header>
      <ClientShell />
    </main>
  )
}
