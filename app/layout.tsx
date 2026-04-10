import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { SITE_NAME, getSiteUrl } from '@/lib/site'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: `${SITE_NAME} — MLB First Inning Betting Edge`,
  description: 'Find the minimum odds you need to bet YRFI with a statistical edge. Model-driven, updated daily.',
  openGraph: {
    title: `${SITE_NAME} — MLB First Inning Betting Edge`,
    description: 'Find the minimum odds you need to bet YRFI with a statistical edge. Model-driven, updated daily.',
    url: getSiteUrl(),
    siteName: SITE_NAME,
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={geist.className}>
        {children}
      </body>
    </html>
  )
}
