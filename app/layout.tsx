import type { Metadata } from "next"
import { Inter, Anton, Bebas_Neue } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/providers/ThemeProvider"

const inter  = Inter({      subsets: ["latin"], variable: "--font-inter"  })
const anton  = Anton({      weight: "400", subsets: ["latin"], variable: "--font-anton"  })
const bebas  = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas"  })

export const metadata: Metadata = {
  title: {
    default: "Voltia — The gym OS built for growth",
    template: "%s | Voltia",
  },
  description:
    "Manage members, track check-ins with QR codes, and build an exercise library — all in one modern platform.",
  openGraph: {
    title: "Voltia — The gym OS built for growth",
    description: "Manage members, track check-ins with QR codes, and build an exercise library — all in one modern platform.",
    siteName: "Voltia",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Voltia — The gym OS built for growth",
    description: "Manage members, track check-ins with QR codes, and build an exercise library — all in one modern platform.",
  },
  other: {
    google: "notranslate",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning translate="no">
      <body className={`${inter.variable} ${anton.variable} ${bebas.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
