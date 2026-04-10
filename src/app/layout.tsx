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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.vrgh.com.br"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "VRGH | Locação de Estrutura Gamer",
    template: "%s | VRGH"
  },
  description:
    "Estrutura gamer para festas e eventos: consoles, PCs, simuladores e realidade virtual, com orçamento automático, valor na hora e reserva online.",
  applicationName: "VRGH",
  alternates: {
    canonical: "/"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true
    }
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "VRGH",
    title: "VRGH | Locação de Estrutura Gamer",
    description:
      "Locação de estrutura gamer para festas e eventos com orçamento automático, valor na hora e reserva online.",
    locale: "pt_BR",
    images: [
      {
        url: "/hero-gamer.jpg",
        width: 1200,
        height: 630,
        alt: "Estrutura gamer para festas e eventos - VRGH"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "VRGH | Locação de Estrutura Gamer",
    description:
      "Locação de estrutura gamer para festas e eventos com orçamento automático, valor na hora e reserva online.",
    images: ["/hero-gamer.jpg"]
  },
  category: "event services"
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
