import type { Metadata } from "next"
import { Manrope } from "next/font/google"
import "./globals.css"

const manrope = Manrope({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Trackly - AI-Powered Application Manager",
  description: "Automate the way you apply for jobs and scholarships with AI-powered intelligence",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={manrope.className}>{children}</body>
    </html>
  )
}
