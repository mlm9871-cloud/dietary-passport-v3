import './globals.css'
import React from 'react'

export const metadata = {
  title: 'Dining Passport',
  description: 'Dietary profile platform for college students'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  )
}
