import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Orbitron } from "next/font/google"
import "./globals.css"
import { SiteFooter } from "@/components/site/SiteFooter"
import { SiteHeader } from "@/components/site/SiteHeader"

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
})

const orbitron = Orbitron({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-gamer"
})

export const metadata: Metadata = {
  title: "VRGH | Locação de Estrutura Gamer",
  description:
    "Estrutura gamer para festas e eventos: consoles, PCs, TVs, monitores e acessórios com orçamento automático e reserva online."
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${inter.className} ${orbitron.variable}`}>
      <body>
        <div className="min-h-dvh flex flex-col">
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  )
}
