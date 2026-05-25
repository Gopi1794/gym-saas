import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function esc(v: unknown): string {
  if (v === null || v === undefined) return ""
  const s = String(v)
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"` : s
}

function csv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(","), ...rows.map(r => r.map(esc).join(","))]
  return "﻿" + lines.join("\r\n") // BOM para Excel en Windows
}

function csvResponse(content: string, filename: string) {
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

function dateAR(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}
function timeAR(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles").select("gym_id, role").eq("id", user.id).single()

  if (profile?.role !== "admin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  const gymId = profile.gym_id
  if (!gymId) return NextResponse.json({ error: "Sin gimnasio" }, { status: 400 })

  const type = req.nextUrl.searchParams.get("type")

  // ── Socios ────────────────────────────────────────────────────────────────
  if (type === "socios") {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, membership_type, membership_expires_at, phone, goal, medical_conditions, total_xp, created_at")
      .eq("gym_id", gymId)
      .eq("role", "member")
      .order("full_name")

    const GOALS: Record<string, string> = {
      lose_weight: "Bajar de peso", gain_muscle: "Ganar músculo",
      performance: "Mejorar rendimiento", maintain: "Mantenerme",
    }

    const headers = ["Nombre", "Membresía", "Vencimiento", "Activo", "Teléfono", "Objetivo", "Condiciones médicas", "XP total", "Miembro desde"]
    const rows = (data ?? []).map(m => [
      m.full_name,
      m.membership_type,
      m.membership_expires_at ? dateAR(m.membership_expires_at) : "",
      m.membership_expires_at && new Date(m.membership_expires_at) > new Date() ? "Sí" : "No",
      m.phone,
      m.goal ? (GOALS[m.goal] ?? m.goal) : "",
      m.medical_conditions,
      m.total_xp,
      dateAR(m.created_at),
    ])

    const stamp = new Date().toISOString().slice(0, 10)
    return csvResponse(csv(headers, rows), `socios_${stamp}.csv`)
  }

  // ── Pagos ─────────────────────────────────────────────────────────────────
  if (type === "pagos") {
    const { data: payments } = await supabase
      .from("payments")
      .select("created_at, amount, status, mp_payment_id, member_id")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })

    const memberIds = [...new Set((payments ?? []).map(p => p.member_id))]
    const { data: profileNames } = memberIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", memberIds)
      : { data: [] }
    const nameMap = new Map((profileNames ?? []).map(p => [p.id, p.full_name]))

    const STATUS: Record<string, string> = {
      approved: "Aprobado", pending: "Pendiente", rejected: "Rechazado",
      cancelled: "Cancelado", refunded: "Reembolsado", cash: "Efectivo",
    }

    const headers = ["Fecha", "Monto (ARS)", "Estado", "Miembro", "ID MercadoPago"]
    const rows = (payments ?? []).map(p => [
      dateAR(p.created_at),
      p.amount,
      STATUS[p.status] ?? p.status,
      nameMap.get(p.member_id) ?? "",
      p.mp_payment_id,
    ])

    const stamp = new Date().toISOString().slice(0, 10)
    return csvResponse(csv(headers, rows), `pagos_${stamp}.csv`)
  }

  // ── Asistencia ────────────────────────────────────────────────────────────
  if (type === "asistencia") {
    const { data: checkIns } = await supabase
      .from("check_ins")
      .select("user_id, checked_in_at, checked_out_at, method")
      .eq("gym_id", gymId)
      .order("checked_in_at", { ascending: false })

    const userIds = [...new Set((checkIns ?? []).map(c => c.user_id))]
    const { data: profileNames } = userIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] }
    const nameMap = new Map((profileNames ?? []).map(p => [p.id, p.full_name]))

    const headers = ["Miembro", "Fecha", "Hora entrada", "Hora salida", "Duración (min)", "Método"]
    const rows = (checkIns ?? []).map(ci => {
      const outTime = ci.checked_out_at ? new Date(ci.checked_out_at) : null
      const inTime = new Date(ci.checked_in_at)
      const durationMin = outTime ? Math.round((outTime.getTime() - inTime.getTime()) / 60000) : ""
      return [
        nameMap.get(ci.user_id) ?? "",
        dateAR(ci.checked_in_at),
        timeAR(ci.checked_in_at),
        ci.checked_out_at ? timeAR(ci.checked_out_at) : "",
        durationMin,
        ci.method,
      ]
    })

    const stamp = new Date().toISOString().slice(0, 10)
    return csvResponse(csv(headers, rows), `asistencia_${stamp}.csv`)
  }

  return NextResponse.json({ error: "Tipo inválido. Usá: socios, pagos o asistencia" }, { status: 400 })
}
