"use client"

import { useState, useEffect } from "react"
import { UserPlus, Copy, Check, Link2, ShieldCheck, Users2, Mail, Info } from "lucide-react"

interface Props {
  inviteCode: string
}

// Logos de marca inline — el proyecto no trae un paquete de íconos de marca
// (react-icons, etc.), así que se agregan como SVG puntuales, mismo enfoque
// que ya se usa para el logo de MercadoPago en otras pantallas.
function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.2h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.8 14.03c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.8-.11-.42-.13-.96-.31-1.65-.6-2.9-1.25-4.79-4.17-4.94-4.36-.14-.2-1.18-1.57-1.18-3 0-1.42.75-2.13 1.02-2.42.27-.29.58-.36.78-.36.2 0 .39 0 .56.01.18.01.42-.07.65.5.24.58.82 2 .9 2.14.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.6.17.29.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.34 1.44.29.15.46.13.63-.07.17-.2.72-.84.92-1.13.19-.29.39-.24.65-.14.27.1 1.7.8 1.99.95.29.15.48.22.55.34.07.13.07.72-.17 1.4Z" />
    </svg>
  )
}

function TelegramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M21.94 3.34 18.6 20.1c-.25 1.11-.9 1.38-1.82.86l-5.02-3.7-2.42 2.33c-.27.27-.5.5-1.02.5l.36-5.14 9.36-8.46c.41-.36-.09-.56-.63-.2L6.06 12.7l-5-1.57c-1.09-.34-1.1-1.09.23-1.61L20.6 2.14c.9-.34 1.7.21 1.34 1.2Z" />
    </svg>
  )
}

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.9h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  )
}

const BULLETS = [
  { icon: Link2, title: "Registro automático", desc: "Se vinculan al gym al registrarse." },
  { icon: ShieldCheck, title: "Seguro y confiable", desc: "Datos protegidos y verificados." },
  { icon: Users2, title: "Más miembros, más comunidad", desc: "Hacé crecer tu gimnasio." },
]

export default function InviteMemberCard({ inviteCode }: Props) {
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const link = origin ? `${origin}/register?gym=${inviteCode}` : `/register?gym=${inviteCode}`
  const shareText = "Te estoy invitando a unirte a VOLTIA 💪"
  const shareMessage = `${shareText}\nRegistrate con este link y quedás conectado directo al gym:\n${link}`

  async function handleCopy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareChannels = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      Icon: WhatsAppIcon,
      href: `https://wa.me/?text=${encodeURIComponent(shareMessage)}`,
      className: "bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/15",
    },
    {
      key: "telegram",
      label: "Telegram",
      Icon: TelegramIcon,
      href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`,
      className: "bg-[#26A5E4]/10 text-[#26A5E4] hover:bg-[#26A5E4]/15",
    },
    {
      key: "facebook",
      label: "Facebook",
      Icon: FacebookIcon,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
      className: "bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/15",
    },
    {
      key: "email",
      label: "Email",
      Icon: Mail,
      href: `mailto:?subject=${encodeURIComponent("Invitación a Voltia")}&body=${encodeURIComponent(shareMessage)}`,
      className: "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
    },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="grid gap-6 p-5 sm:grid-cols-2 sm:divide-x sm:divide-zinc-200 sm:dark:divide-zinc-800">
        {/* Columna izquierda — qué es esto */}
        <div className="space-y-4 sm:pr-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600/10 text-brand-500">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">Invitar nuevo miembro</p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Compartí este link para que los socios se registren y queden vinculados automáticamente al gym.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {BULLETS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600/10 text-brand-500">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Columna derecha — link + compartir */}
        <div className="space-y-4 sm:pl-6">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Link de invitación</p>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/60">
              <Link2 className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
              <span className="flex-1 truncate text-xs text-zinc-600 dark:text-zinc-400 font-mono">{link}</span>
            </div>
            <button
              onClick={handleCopy}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar link
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-xs text-zinc-400 dark:text-zinc-600">o</span>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Compartir por</p>
            <div className="grid grid-cols-4 gap-2">
              {shareChannels.map(({ key, label, Icon, href, className }) => (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex flex-col items-center gap-1.5 rounded-xl border border-zinc-200 py-2.5 text-[11px] font-medium transition-colors dark:border-zinc-800 ${className}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </a>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-zinc-100 px-3 py-2.5 dark:bg-zinc-800/50">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Cualquiera que se registre con este link quedará asociado a tu gimnasio automáticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
