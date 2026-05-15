import type { Metadata } from "next"
import { Inter, Anton, Bebas_Neue } from "next/font/google"
import "./globals.css"

const inter  = Inter({      subsets: ["latin"], variable: "--font-inter"  })
const anton  = Anton({      weight: "400", subsets: ["latin"], variable: "--font-anton"  })
const bebas  = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas"  })

export const metadata: Metadata = {
  title: {
    default: "GymFlow — The gym OS built for growth",
    template: "%s | GymFlow",
  },
  description:
    "Manage members, track check-ins with QR codes, and build an exercise library — all in one modern platform.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${anton.variable} ${bebas.variable} font-sans`}>{children}</body>
    </html>
  )
}
