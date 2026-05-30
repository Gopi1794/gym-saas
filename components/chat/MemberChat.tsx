"use client"

import { useState, useRef, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { MessageCircle, X, Send, Loader2, Dumbbell, Apple, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { AISparkle } from "./AISparkle"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
}

const QUICK_ACTIONS = [
  {
    icon: Dumbbell,
    title: "Rutinas de entrenamiento",
    subtitle: "Planes personalizados según tu objetivo",
    prompt: "¿Podés armarme una rutina de entrenamiento personalizada según mi objetivo?",
  },
  {
    icon: Apple,
    title: "Nutrición y dieta",
    subtitle: "Consejos y planes alimenticios",
    prompt: "Dame consejos de nutrición y alimentación para mi objetivo.",
  },
  {
    icon: Target,
    title: "Técnica y ejercicios",
    subtitle: "Cómo hacer los ejercicios correctamente",
    prompt: "¿Cómo puedo mejorar mi técnica en los ejercicios principales?",
  },
  {
    icon: MessageCircle,
    title: "Otro tipo de consulta",
    subtitle: "Preguntame lo que necesites",
    prompt: "",
  },
]

const WELCOME = "¡Hola! Soy tu asistente de fitness 💪 Preguntame sobre ejercicios, técnica, nutrición o lo que necesites. Estoy aquí para ayudarte a lograr tus objetivos."

export default function MemberChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: WELCOME },
  ])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasUserMessages = messages.some((m) => m.role === "user")

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  async function sendMessage(text = input.trim()) {
    if (!text || streaming) return

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text }
    const assistantId = crypto.randomUUID()

    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }])
    setInput("")
    setStreaming(true)

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.id !== "welcome")
        .map(({ role, content }) => ({ role, content }))

      const res = await fetch("/api/chat/member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      })

      if (!res.ok || !res.body) throw new Error("Error en la respuesta")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m)
        )
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: "Ocurrió un error. Intentá de nuevo." } : m
        )
      )
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); sendMessage() }
  }

  function handleQuickAction(action: typeof QUICK_ACTIONS[0]) {
    if (action.prompt) {
      sendMessage(action.prompt)
    } else {
      inputRef.current?.focus()
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
        aria-label="Abrir asistente"
      >
        <AISparkle size={34} strokeWidth={2} duration={2.4} />
      </motion.button>

      {/* Backdrop + modal */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Chat panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 16 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              {/* Animated gradient border wrapper — @property anima el ángulo sin mover el DOM */}
              <div
                className="chat-animated-border pointer-events-auto relative h-full max-h-[680px] w-full max-w-[440px] rounded-3xl p-[1.5px] shadow-[0_0_40px_rgba(213,0,0,0.25)]"
                onClick={(e) => e.stopPropagation()}
              >

                {/* Inner panel */}
                <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(1.5rem-1.5px)] bg-white dark:bg-zinc-900">

                  {/* Header — gradiente rojo funciona bien en ambos modos */}
                  <div className="flex items-center gap-3 bg-gradient-to-b from-brand-800 to-brand-950 px-5 py-4 shrink-0 dark:to-zinc-900">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/20 shadow-[0_0_20px_rgba(213,0,0,0.5)]">
                      <AISparkle size={38} strokeWidth={2} duration={2.4} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-white">Asistente GymFlow</p>
                      <p className="text-sm text-brand-200">Tu coach personal con IA</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                        <span className="text-xs text-white/80">En línea</span>
                      </div>
                      <button
                        onClick={() => setOpen(false)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="min-h-0 flex-1 overflow-y-auto p-5">
                    <div className="space-y-4">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}
                        >
                          {m.role === "assistant" && (
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                              <AISparkle size={24} strokeWidth={1.8} duration={2.4} />
                            </div>
                          )}
                          <div
                            className={cn(
                              "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                              m.role === "user"
                                ? "rounded-br-sm bg-brand-700 text-white"
                                : "rounded-bl-sm bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                            )}
                          >
                            {m.content || (
                              <span className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Escribiendo…
                              </span>
                            )}
                          </div>
                        </div>
                      ))}

                      {!hasUserMessages && (
                        <div className="space-y-2 pt-1">
                          {QUICK_ACTIONS.map((action) => {
                            const Icon = action.icon
                            return (
                              <button
                                key={action.title}
                                onClick={() => handleQuickAction(action)}
                                className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-left transition-colors hover:border-brand-300 hover:bg-zinc-100 dark:border-zinc-700/60 dark:bg-zinc-800/60 dark:hover:border-brand-700/60 dark:hover:bg-zinc-800"
                              >
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/60">
                                  <Icon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{action.title}</p>
                                  <p className="text-xs text-zinc-500">{action.subtitle}</p>
                                </div>
                                <span className="text-brand-500">›</span>
                              </button>
                            )
                          })}
                        </div>
                      )}

                      <div ref={bottomRef} />
                    </div>
                  </div>

                  {/* Input */}
                  <div className="shrink-0 border-t border-zinc-200 px-4 pb-3 pt-3 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Escribe tu pregunta..."
                        disabled={streaming}
                        className="flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/40 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                      />
                      <button
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || streaming}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white shadow-[0_0_16px_rgba(213,0,0,0.4)] transition-all hover:bg-brand-600 disabled:opacity-40 disabled:shadow-none"
                      >
                        {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="mt-2 text-center text-[11px] text-zinc-400 dark:text-zinc-600">
                      Presiona Enter para enviar · Shift + Enter para nueva línea
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="flex shrink-0 items-center justify-center gap-2 border-t border-zinc-200 py-2.5 dark:border-zinc-800">
                    <AISparkle size={14} strokeWidth={1.4} duration={2.4} />
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-600">
                      Powered by <span className="font-semibold text-brand-500">GymFlow IA</span>
                    </p>
                    <AISparkle size={14} strokeWidth={1.4} duration={2.4} />
                  </div>

                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
