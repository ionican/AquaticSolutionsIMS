import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { RoleProvider } from '@/components/role-provider'
import { getAuthenticatedUser, getUserRole } from '@/lib/auth'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Project Manager',
  description: 'Project management system for site staff',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Role for hiding controls in client components. Null on the login and
  // invite pages, where nobody is signed in yet.
  const user = await getAuthenticatedUser()

  return (
    <html lang="en" className="bg-background">
      <body className="font-sans antialiased">
        <RoleProvider userId={user?.id ?? null} role={getUserRole(user)}>
          {children}
        </RoleProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
