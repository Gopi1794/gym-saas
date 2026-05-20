"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Bell, Users, QrCode, Trophy, Dumbbell, Clock, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

// Contador de módulo — garantiza nombre de canal único incluso en el doble-mount de StrictMode
// (Date.now() puede repetirse en la misma ms; un contador nunca se repite)
let _channelSeq = 0

type NotificationType = "new_member" | "check_in" | "achievement" | "plan_assigned" | "membership_expiring"

interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  metadata: Record<string, unknown>
  created_at: string
}

const TYPE_ICON: Record<NotificationType, React.ElementType> = {
  new_member:          Users,
  check_in:            QrCode,
  achievement:         Trophy,
  plan_assigned:       Dumbbell,
  membership_expiring: Clock,
}

const TYPE_COLOR: Record<NotificationType, string> = {
  new_member:          "bg-brand-700/20 text-brand-400",
  check_in:            "bg-zinc-700/40 text-zinc-400",
  achievement:         "bg-amber-500/15 text-amber-400",
  plan_assigned:       "bg-blue-500/15 text-blue-400",
  membership_expiring: "bg-red-500/15 text-red-400",
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "ahora"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

interface NotificationBellProps {
  userId: string
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  // Cada instancia del componente captura su propio número de secuencia al montarse
  const seqRef = useRef(++_channelSeq)
  const supabase = useMemo(() => createClient(), [])

  const unreadCount = notifications.filter((n) => !n.read).length

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("notifications" as never)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30) as { data: Notification[] | null }
      if (data) setNotifications(data)
    } catch {
      // tabla aún no existe (migración pendiente)
    }
  }, [supabase, userId])

  // Realtime subscription — canal con sufijo único evita el doble-mount de StrictMode
  useEffect(() => {
    if (!userId) return

    fetchNotifications()

    // Limpiar canal previo antes de crear uno nuevo
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`notifications:${userId}:${seqRef.current}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: Notification }) => {
          setNotifications((prev) => [payload.new, ...prev])
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      channel.unsubscribe().catch(() => {})
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [userId, fetchNotifications, supabase])

  // Click outside to close
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  // Mark all as read when opening
  async function handleOpen() {
    setOpen((v) => !v)
    if (!open && unreadCount > 0) {
      await supabase
        .from("notifications" as never)
        .update({ read: true } as never)
        .eq("user_id", userId)
        .eq("read", false)
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    }
  }

  async function dismiss(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await supabase
      .from("notifications" as never)
      .delete()
      .eq("id", id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        aria-label="Notificaciones"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:text-zinc-100 cursor-pointer"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed right-0 top-14 z-[70] w-full sm:absolute sm:left-0 sm:right-auto sm:top-full sm:mt-2 sm:w-80">
          <div className="mx-2 sm:mx-0 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <p className="text-sm font-semibold text-zinc-100">Notificaciones</p>
              {notifications.length > 0 && (
                <button
                  onClick={async () => {
                    await supabase.from("notifications" as never).delete().eq("user_id", userId)
                    setNotifications([])
                  }}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
                >
                  Limpiar todo
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[min(24rem,calc(100dvh-8rem))] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Bell className="h-8 w-8 text-zinc-700" />
                  <p className="text-sm text-zinc-600">Sin notificaciones</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const Icon = TYPE_ICON[n.type] ?? Bell
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "group relative flex gap-3 px-4 py-3 border-b border-zinc-800/50 last:border-0",
                        !n.read && "bg-zinc-900/60"
                      )}
                    >
                      {/* Unread dot */}
                      {!n.read && (
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-brand-500" />
                      )}

                      {/* Icon */}
                      <div className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        TYPE_COLOR[n.type]
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-zinc-200 leading-snug">{n.title}</p>
                        <p className="mt-0.5 text-xs text-zinc-500 leading-snug">{n.body}</p>
                        <p className="mt-1 text-[10px] text-zinc-700">{timeAgo(n.created_at)}</p>
                      </div>

                      {/* Dismiss */}
                      <button
                        onClick={(e) => dismiss(n.id, e)}
                        className="opacity-0 group-hover:opacity-100 flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-600 hover:text-zinc-300 transition-all cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
