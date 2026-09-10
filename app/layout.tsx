import type { Metadata } from "next"
import { Inter, Anton, Bebas_Neue } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/providers/ThemeProvider"
import { ToastProvider } from "@/components/providers/ToastProvider"
import { SpeedInsights } from "@vercel/speed-insights/next"

const inter  = Inter({      subsets: ["latin"], variable: "--font-inter"  })
const anton  = Anton({      weight: "400", subsets: ["latin"], variable: "--font-anton"  })
const bebas  = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas"  })

export const metadata: Metadata = {
  title: {
    default: "Voltia — El sistema operativo para gimnasios",
    template: "%s | Voltia",
  },
  description:
    "Gestioná socios, check-ins QR, entrenamientos, nutrición, pagos y reportes en una sola plataforma moderna para gimnasios.",
  openGraph: {
    title: "Voltia — El sistema operativo para gimnasios",
    description: "Gestioná socios, check-ins QR, entrenamientos, nutrición, pagos y reportes en una sola plataforma moderna para gimnasios.",
    siteName: "Voltia",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Voltia — El sistema operativo para gimnasios",
    description: "Gestioná socios, check-ins QR, entrenamientos, nutrición, pagos y reportes en una sola plataforma moderna para gimnasios.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Voltia",
  },
  other: {
    google: "notranslate",
    "mobile-web-app-capable": "yes",
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
          <ToastProvider />
          {children}
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}
