import type { Metadata } from "next"
import { Manrope, Crimson_Text } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/contexts/AuthContext"
import { ToastProvider } from "@/components/ui/use-toast"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

const manrope = Manrope({ subsets: ["latin"] })
const crimsonText = Crimson_Text({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-crimson"
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.applyos.io'),
  title: {
    default: 'ApplyOS | The AI Operating System for Your Job Search',
    template: '%s | ApplyOS',
  },
  description: 'Stop juggling spreadsheets. ApplyOS extracts job questions, auto-fills applications with AI, and tracks your status in one command center.',
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-icon?v=1",
  },
  openGraph: {
    title: 'ApplyOS | Automate Your Job Search',
    description: 'Auto-fill applications 10x faster with AI.',
    url: 'https://www.applyos.io',
    siteName: 'ApplyOS',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ApplyOS | The AI Job Search OS',
    description: 'Auto-fill applications and track status in one place.',
    creator: '@applyos',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${manrope.className} ${crimsonText.variable}`} suppressHydrationWarning>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
