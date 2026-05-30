"use client"

import { useState, useEffect } from "react"
import { Link2, Copy, Check } from "lucide-react"

interface Props {
  inviteCode: string
}

export default function InviteLink({ inviteCode }: Props) {
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const url = origin
    ? `${origin}/register?gym=${inviteCode}`
    : `/register?gym=${inviteCode}`

  async function handleCopy() {
    const link = `${window.location.origin}/register?gym=${inviteCode}`
    const message = `Te estoy invitando a unirte a GYMFLOW 💪\nRegistrate con este link y quedás conectado directo al gym:\n${link}`
    await navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3">
      <Link2 className="h-4 w-4 shrink-0 text-zinc-500" />
      <span className="flex-1 truncate text-xs text-zinc-400 font-mono">
        {url}
      </span>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-emerald-400">Copiado</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </>
        )}
      </button>
    </div>
  )
}
