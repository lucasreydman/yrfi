import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { SITE_NAME, getSiteUrl } from '@/lib/site'

const geist = Geist({ subsets: ['latin'] })
const metadataTitle = 'YRFI: Model-driven MLB first-inning edge'
const metadataDescription = 'Find the minimum odds you need to bet YRFI with a statistical edge. Model-driven, updated daily.'
const ogImageUrl = `${getSiteUrl()}/yrfi-opengraph.png`

export const metadata: Metadata = {
  title: {
    absolute: metadataTitle,
  },
  description: metadataDescription,
  icons: {
    icon: [
      { url: '/yrfi-ballmark.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/yrfi-ballmark.svg',
    apple: '/yrfi-ballmark.svg',
  },
  openGraph: {
    title: metadataTitle,
    description: metadataDescription,
    url: getSiteUrl(),
    siteName: SITE_NAME,
    type: 'website',
    images: [
      {
        url: ogImageUrl,
        alt: 'YRFI open graph image',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: metadataTitle,
    description: metadataDescription,
    images: [ogImageUrl],
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
