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
  title: "ApplyOS - AI-Powered Application & Career Manager",
  description: "Automate your career journey with AI-powered intelligence, document analysis, and interview practice.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-icon?v=1",
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
