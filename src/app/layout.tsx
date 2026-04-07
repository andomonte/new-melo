import '@/styles/globals.css'
import { Toaster } from 'sonner'

export const metadata = {
  title: 'Sistema Melo',
  description: 'Sistema de Gestão Empresarial',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
