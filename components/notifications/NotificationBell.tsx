"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Bell, Users, QrCode, Trophy, Dumbbell, Clock, Scale, AlertTriangle, ChevronRight, X, MessageCircle, UserRoundPlus, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { formatDayAR } from "@/lib/date-ar"
import { normalizePhoneAR, whatsappNumber } from "@/lib/phone"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import type { RealtimeChannel } from "@supabase/supabase-js"

// Contador de módulo — garantiza nombre de canal único incluso en el doble-mount de StrictMode
// (Date.now() puede repetirse en la misma ms; un contador nunca se repite)
let _channelSeq = 0

type NotificationType = "new_member" | "check_in" | "achievement" | "plan_assigned" | "membership_expiring" | "churn_alert" | "weight_drift"

interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  metadata: Record<string, unknown>
  created_at: string
  contacted_at: string | null
}

interface MemberSnapshot {
  phone: string | null
  membership_expires_at: string | null
}

// Ícono + color por tipo — grano fino, cada tipo se ve distinto aunque
// comparta categoría (new_member y weight_drift son los dos "Sistema", pero
// no se ven igual).
const TYPE_ICON: Record<NotificationType, React.ElementType> = {
  new_member:          Users,
  check_in:            QrCode,
  achievement:         Trophy,
  plan_assigned:       Dumbbell,
  membership_expiring: Clock,
  churn_alert:         AlertTriangle,
  weight_drift:        Scale,
}

const TYPE_COLOR: Record<NotificationType, string> = {
  new_member:          "bg-brand-700/20 text-brand-400",
  check_in:            "bg-zinc-700/40 text-zinc-400",
  achievement:         "bg-amber-500/15 text-amber-400",
  plan_assigned:       "bg-blue-500/15 text-blue-400",
  membership_expiring: "bg-red-500/15 text-red-400",
  churn_alert:         "bg-orange-500/15 text-orange-400",
  weight_drift:        "bg-amber-500/15 text-amber-400",
}

// Categoría — grano grueso, para el tag de cada card y los chips de filtro.
// Única fuente: el tag de una notificación y su chip (si tiene) salen del
// mismo lugar, nunca se definen dos veces.
type CategoryKey = "check_in" | "system" | "achievement"

const TYPE_CATEGORY: Record<NotificationType, CategoryKey> = {
  check_in:            "check_in",
  new_member:          "system",
  plan_assigned:       "system",
  membership_expiring: "system",
  churn_alert:         "system",
  weight_drift:        "system",
  achievement:         "achievement",
}

const CATEGORY_META: Record<CategoryKey, { tagLabel: string; chipLabel: string | null; tagClass: string }> = {
  check_in: {
    tagLabel:  "Check-in",
    chipLabel: "Check-ins",
    tagClass:  "bg-brand-600/10 text-brand-700 dark:bg-brand-700/15 dark:text-brand-400",
  },
  system: {
    tagLabel:  "Sistema",
    chipLabel: "Sistema",
    tagClass:  "bg-zinc-200 text-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-400",
  },
  // Sin chipLabel a propósito: no hace falta paridad 1:1 entre tags y chips.
  // "Logros" tiene tag propio pero cae bajo "Todas" — agregar su chip es
  // una línea acá si hace falta más adelante.
  achievement: {
    tagLabel:  "Logros",
    chipLabel: null,
    tagClass:  "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  },
}

function getNotificationHref(n: Notification): string | null {
  switch (n.type) {
    case "check_in":
      return "/check-in?tab=log"
    case "weight_drift": {
      const planId = n.metadata?.plan_id
      return typeof planId === "string" ? `/nutricion/${planId}` : null
    }
    default:
      return null
  }
}

// Calcula si una notificación de vencimiento dirigida al admin sigue siendo
// una tarea pendiente. Compara por día calendario, no por instante — mismo
// criterio que la función SQL: un re-guardado del socio que no cambia el
// día no debe leerse como "renovó".
function getContactState(
  n: Notification,
  snapshots: Record<string, MemberSnapshot>
): { memberId: string; phone: string | null; isPending: boolean } | null {
  if (n.type !== "membership_expiring") return null
  const memberId = n.metadata?.member_id
  if (typeof memberId !== "string") return null // caso socio, no caso admin
  if (n.contacted_at) return { memberId, phone: null, isPending: false }

  const snap = snapshots[memberId]
  if (!snap) return null // todavía no llegó el snapshot del perfil

  const snapshotDay = typeof n.metadata?.expires_at === "string" ? n.metadata.expires_at.split("T")[0] : null
  const currentDay = snap.membership_expires_at ? snap.membership_expires_at.split("T")[0] : null
  const renewed = !!(snapshotDay && currentDay && currentDay > snapshotDay)

  return { memberId, phone: snap.phone, isPending: !renewed }
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
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [memberSnapshots, setMemberSnapshots] = useState<Record<string, MemberSnapshot>>({})
  const [open, setOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<"all" | CategoryKey>("all")
  const [confirmingClearAll, setConfirmingClearAll] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  // Cada instancia del componente captura su propio número de secuencia al montarse
  const seqRef = useRef(++_channelSeq)
  const supabase = useMemo(() => createClient(), [])

  function handleNotificationClick(href: string) {
    setOpen(false)
    router.push(href)
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  const categoryUnreadCounts = (Object.keys(CATEGORY_META) as CategoryKey[]).reduce((acc, key) => {
    acc[key] = notifications.filter((n) => !n.read && TYPE_CATEGORY[n.type] === key).length
    return acc
  }, {} as Record<CategoryKey, number>)

  const categoryChips = (Object.entries(CATEGORY_META) as [CategoryKey, typeof CATEGORY_META[CategoryKey]][])
    .filter(([, meta]) => meta.chipLabel)

  const visibleNotifications = selectedCategory === "all"
    ? notifications
    : notifications.filter((n) => TYPE_CATEGORY[n.type] === selectedCategory)

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("notifications" as never)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30) as { data: Notification[] | null }
      if (!data) return
      setNotifications(data)

      // Snapshot de perfil solo para las tareas de vencimiento todavía
      // abiertas — es lo único que necesita saber si el socio sigue
      // pendiente o ya renovó, y con qué teléfono contactarlo.
      const memberIds = Array.from(new Set(
        data
          .filter((n) => n.type === "membership_expiring" && !n.contacted_at && typeof n.metadata?.member_id === "string")
          .map((n) => n.metadata.member_id as string)
      ))
      if (memberIds.length === 0) return

      const { data: profilesData } = await supabase
        .from("profiles" as never)
        .select("id, phone, membership_expires_at")
        .in("id", memberIds) as { data: ({ id: string } & MemberSnapshot)[] | null }
      if (profilesData) {
        setMemberSnapshots(
          Object.fromEntries(profilesData.map((p) => [p.id, { phone: p.phone, membership_expires_at: p.membership_expires_at }]))
        )
      }
    } catch {
      // tabla aún no existe (migración pendiente)
    }
  }, [supabase, userId])

  async function handleContact(n: Notification, memberId: string, phone: string) {
    const normalized = normalizePhoneAR(phone)
    if (!normalized) return // defensivo — el botón no debería llamar a esto sin un teléfono válido

    const memberName = typeof n.metadata?.member_name === "string" ? n.metadata.member_name : "Hola"
    const expiresRaw = typeof n.metadata?.expires_at === "string" ? n.metadata.expires_at : null
    const dateLabel = expiresRaw ? formatDayAR(expiresRaw) : ""
    const message = `Hola ${memberName}! Tu membresía vence el ${dateLabel}. ¿Querés renovarla para seguir entrenando sin cortes?`
    const url = `https://wa.me/${whatsappNumber(normalized)}?text=${encodeURIComponent(message)}`
    window.open(url, "_blank", "noopener,noreferrer")

    const nowIso = new Date().toISOString()
    await supabase
      .from("notifications" as never)
      .update({ contacted_at: nowIso } as never)
      .eq("id", n.id)
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, contacted_at: nowIso } : x)))
  }

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
      .on(
        "postgres_changes" as never,
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: Notification }) => {
          setNotifications((prev) => prev.map((n) => (n.id === payload.new.id ? payload.new : n)))
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

  // Click afuera o Escape cierran el panel — pausado mientras el diálogo de
  // confirmación está abierto: Dialog es un Radix Portal, renderiza fuera de
  // panelRef, así que un click o Escape adentro del diálogo se leería como
  // "cerrar el panel" por debajo (Radix ya maneja su propio Escape para
  // cerrarse a sí mismo).
  useEffect(() => {
    if (!open || confirmingClearAll) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, confirmingClearAll])

  const markAllRead = useCallback(async () => {
    await supabase
      .from("notifications" as never)
      .update({ read: true } as never)
      .eq("user_id", userId)
      .eq("read", false)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [supabase, userId])

  // Marcar como leídas al CERRAR, no al abrir — si no, los puntos de no-leída
  // desaparecen mientras el usuario todavía está mirando el panel y nunca
  // llega a ver cuáles eran nuevas. Un solo punto de disparo (la transición
  // open→false) en vez de repetir la llamada en cada lugar que cierra el
  // panel (bell, click afuera, Escape, click en una notificación que
  // navega) — así ninguno de esos caminos puede quedar afuera por olvido.
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      markAllRead()
    }
    wasOpenRef.current = open
  }, [open, markAllRead])

  async function confirmClearAll() {
    setConfirmingClearAll(false)
    await supabase.from("notifications" as never).delete().eq("user_id", userId)
    setNotifications([])
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
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 cursor-pointer"
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
        <div className="fixed right-0 top-14 z-[9999] w-full sm:absolute sm:left-0 sm:right-auto sm:top-full sm:mt-2 sm:w-96">
          <div className="mx-2 sm:mx-0 rounded-xl border border-zinc-200 bg-white shadow-2xl overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notificaciones</p>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors cursor-pointer"
                  >
                    Marcar todas como leídas
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={() => setConfirmingClearAll(true)}
                    className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors cursor-pointer"
                  >
                    Limpiar todo
                  </button>
                )}
              </div>
            </div>

            {/* Filter chips */}
            {notifications.length > 0 && (
              <div className="flex gap-2 overflow-x-auto border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors cursor-pointer",
                    selectedCategory === "all"
                      ? "bg-brand-600 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  )}
                >
                  Todas
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                    selectedCategory === "all" ? "bg-white/20" : "bg-zinc-300/60 dark:bg-zinc-700"
                  )}>
                    {unreadCount}
                  </span>
                </button>
                {categoryChips.map(([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedCategory(key)}
                    className={cn(
                      "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors cursor-pointer",
                      selectedCategory === key
                        ? "bg-brand-600 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    )}
                  >
                    {meta.chipLabel}
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                      selectedCategory === key ? "bg-white/20" : "bg-zinc-300/60 dark:bg-zinc-700"
                    )}>
                      {categoryUnreadCounts[key]}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* List */}
            <div className="max-h-[min(28rem,calc(100dvh-8rem))] overflow-y-auto p-3 space-y-2.5">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Bell className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                  <p className="text-sm text-zinc-500 dark:text-zinc-600">Sin notificaciones</p>
                </div>
              ) : visibleNotifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Bell className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                  <p className="text-sm text-zinc-500 dark:text-zinc-600">Nada en esta categoría</p>
                </div>
              ) : (
                visibleNotifications.map((n) => {
                  const Icon = TYPE_ICON[n.type] ?? Bell
                  const href = getNotificationHref(n)
                  const category = CATEGORY_META[TYPE_CATEGORY[n.type]]
                  const contact = getContactState(n, memberSnapshots)
                  const contactPhone = contact?.phone ? normalizePhoneAR(contact.phone) : null
                  return (
                    <div
                      key={n.id}
                      role={href ? "button" : undefined}
                      tabIndex={href ? 0 : undefined}
                      onClick={href ? () => handleNotificationClick(href) : undefined}
                      onKeyDown={href ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleNotificationClick(href)
                        }
                      } : undefined}
                      className={cn(
                        "group relative flex items-start gap-3 rounded-2xl border p-3 transition-colors",
                        n.read
                          ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/20"
                          : "border-zinc-200 bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-900/60",
                        href && "cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700"
                      )}
                    >
                      {/* Unread dot — adentro de la card (no en el borde/esquina): con el
                          borde siempre visible ahora, un offset negativo quedaba tapado o
                          cortado por el rounded-2xl. Sin ring: ya no está a caballo de un
                          borde/costura, se apoya limpio sobre el propio fondo de la card. */}
                      {!n.read && (
                        <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-brand-500" />
                      )}

                      {/* Icon */}
                      <div className={cn(
                        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                        TYPE_COLOR[n.type]
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1 py-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            "text-xs leading-snug text-zinc-900 dark:text-zinc-100",
                            n.read ? "font-medium" : "font-semibold"
                          )}>
                            {n.title}
                          </p>
                          <p className="shrink-0 pt-0.5 text-[10px] text-zinc-400 dark:text-zinc-600">{timeAgo(n.created_at)}</p>
                        </div>
                        <p className="mt-1 text-xs leading-snug text-zinc-500">{n.body}</p>
                        <div className="mt-2 flex items-center gap-1">
                          <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", category.tagClass)}>
                            {category.tagLabel}
                          </span>
                          {href && <ChevronRight className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-600" />}
                        </div>

                        {/* Tarea de vencimiento: contactar por WhatsApp, cargar teléfono
                            si falta, o el tag de que ya se gestionó. Nunca las tres — el
                            estado se calcula, no se guarda como bandera aparte. */}
                        {contact && contact.isPending && contactPhone && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleContact(n, contact.memberId, contact.phone!) }}
                            className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 min-h-11 text-[11px] font-semibold text-white hover:bg-emerald-500 transition-colors cursor-pointer"
                          >
                            <MessageCircle className="h-3 w-3" aria-hidden />
                            Contactar por WhatsApp
                          </button>
                        )}
                        {contact && contact.isPending && !contactPhone && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpen(false); router.push(`/members/${contact.memberId}`) }}
                            className="mt-2 flex items-center gap-1.5 min-h-11 text-[11px] font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                          >
                            <UserRoundPlus className="h-3 w-3" aria-hidden />
                            Cargar teléfono
                          </button>
                        )}
                        {contact && !contact.isPending && n.contacted_at && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" aria-hidden />
                            Gestionada
                          </div>
                        )}
                      </div>

                      {/* Dismiss — siempre visible (hover no existe en touch), 44×44 de hit
                          area aunque el ícono se vea de 14px */}
                      <button
                        onClick={(e) => dismiss(n.id, e)}
                        aria-label="Descartar notificación"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-600 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
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

      {/* Clear all confirmation */}
      <Dialog open={confirmingClearAll} onOpenChange={setConfirmingClearAll}>
        <DialogContent className="sm:max-w-sm border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-50">¿Borrar todas las notificaciones?</DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
              Se eliminan las {notifications.length} notificaciones de esta lista. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setConfirmingClearAll(false)}
              className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmClearAll}
              className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition-colors"
            >
              Borrar todo
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
