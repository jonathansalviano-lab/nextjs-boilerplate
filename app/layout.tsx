import type React from "react"
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Hours Calculator - Space Coast Services",
  description: "Professional hours tracking and submission system for hotel employees - Space Coast Services",
  keywords: "hours calculator, time tracking, hotel employees, Space Coast Services, work hours",
  authors: [{ name: "Space Coast Services" }],
  openGraph: {
    title: "Hours Calculator - Space Coast Services",
    description: "Professional hours tracking and submission system for hotel employees",
    type: "website",
  },
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
