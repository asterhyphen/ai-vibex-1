import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import { RealtimeAlertsProvider } from '@/components/ui/RealtimeAlertsProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'MITE Canteen',
  description: 'Pre-order food and print services at MITE',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* App Router root layout applies font links globally; static <link> keeps offline builds working */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@600;700&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text)]">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <RealtimeAlertsProvider>{children}</RealtimeAlertsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
