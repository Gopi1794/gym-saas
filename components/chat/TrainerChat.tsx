"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ClipboardList, FileText, ExternalLink } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { AISparkle } from "./AISparkle"
import ChatPanel, { Message, QuickAction } from "./ChatPanel"

const WELCOME = "Hola. Puedo crear planes de entrenamiento desde una descripción o importar un plan desde texto. ¿Qué necesitás?"

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: ClipboardList,
    title: "Crear plan desde descripción",
    subtitle: "Describí el miembro, deporte y objetivo",
    prompt: "Quiero crear un plan de entrenamiento.",
  },
  {
    icon: FileText,
    title: "Importar plan desde texto",
    subtitle: "Pegá el texto de una rutina existente",
    prompt: "Quiero importar un plan desde un documento.",
  },
]

export default function TrainerChat() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  async function handleResponse(
    text: string,
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
    assistantId: string
  ) {
    const messages = [] as { role: "user" | "assistant"; content: string }[]

    setMessages((prev) => {
      const history = prev
        .filter((m) => m.id !== "welcome")
        .map(({ role, content }) => ({ role, content }))
      messages.push(...history)
      return prev
    })

    try {
      const res = await fetch("/api/chat/trainer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, { role: "user", content: text }] }),
      })

      if (!res.ok) throw new Error()
      const data = await res.json() as { reply: string; planId?: string }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: data.reply,
                action: data.planId ? (
                  <button
                    onClick={() => { setOpen(false); router.push(`/planes/${data.planId}`) }}
                    className="flex items-center gap-2 self-start rounded-xl border border-brand-700/40 bg-brand-700/10 px-3 py-2 text-xs font-semibold text-brand-500 transition-colors hover:bg-brand-700/20"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver y editar el plan
                  </button>
                ) : undefined,
              }
            : m
        )
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: "Ocurrió un error. Intentá de nuevo." } : m
        )
      )
    }
  }

  return (
    <>
      {/* Floating bubble */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className={cn(
          "fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-[0_0_28px_rgba(213,0,0,0.55)] md:bottom-6 md:right-6",
          open && "pointer-events-none opacity-0"
        )}
        aria-label="Abrir asistente trainer"
      >
        <AISparkle size={34} strokeWidth={2} duration={2.4} />
      </motion.button>

      <ChatPanel
        open={open}
        onClose={() => setOpen(false)}
        title="Asistente Trainer"
        subtitle="Creación e importación de planes"
        welcomeMessage={WELCOME}
        quickActions={QUICK_ACTIONS}
        endpoint="/api/chat/trainer"
        onResponse={handleResponse}
      />
    </>
  )
}
