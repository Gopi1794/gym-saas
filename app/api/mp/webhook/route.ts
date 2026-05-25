import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"

interface MpNotification {
  type: string
  data: {
    id: string
    external_reference?: string
  }
}

function verifyMpSignature(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) {
    // Sin secret configurado: solo en dev, loguear advertencia
    console.warn("[mp/webhook] MP_WEBHOOK_SECRET no configurado — omitiendo verificación de firma")
    return true
  }

  const xSignature = req.headers.get("x-signature") ?? ""
  const xRequestId = req.headers.get("x-request-id") ?? ""

  // Parsear ts y v1 del header X-Signature
  const parts = Object.fromEntries(xSignature.split("&").map(p => p.split("=")))
  const ts = parts["ts"]
  const v1 = parts["v1"]
  if (!ts || !v1) return false

  // Extraer data.id del body para armar el template
  let dataId: string
  try {
    dataId = JSON.parse(rawBody)?.data?.id ?? ""
  } catch {
    return false
  }

  const template = `id:${dataId};request-id:${xRequestId};ts:${ts}`
  const expected = createHmac("sha256", secret).update(template).digest("hex")

  return expected === v1
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verifyMpSignature(req, rawBody)) {
    console.warn("[mp/webhook] firma inválida — request rechazado")
    return NextResponse.json({ error: "Invalid signature" }, { status:401 })
  }

  let notification: MpNotification
  try {
    notification = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: true })
  }

  if (notification?.type !== "payment" || !notification?.data?.id) {
    return NextResponse.json({ ok: true })
  }

  try {
    await processPayment(notification.data.id, notification.data.external_reference)
  } catch (err) {
    console.error("[mp/webhook] error processing payment:", notification.data.id, err)
  }

  return NextResponse.json({ ok: true })
}

async function processPayment(paymentId: string, externalRef?: string) {
  const admin = createAdminClient()

  // Idempotency: skip if already processed
  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("mp_payment_id", paymentId)
    .maybeSingle()

  if (existing) return

  // Parse external_reference: {member_id}__{gym_id}__{membership_type}__{timestamp}
  const parts = externalRef?.split("__") ?? []
  const memberId = parts[0]
  const gymId = parts[1]
  const membershipType = parts[2] as "basic" | "premium" | "vip" | undefined

  if (!gymId || !memberId) {
    console.warn("[mp/webhook] missing external_reference, skipping:", paymentId)
    return
  }

  // Get gym's MP token from Vault
  const { data: mpToken } = await admin.rpc("get_mp_token_for_checkout", {
    p_gym_id: gymId,
  })
  if (!mpToken) {
    console.warn("[mp/webhook] no mp token for gym:", gymId)
    return
  }

  // Fetch payment details from MercadoPago
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mpToken}` },
  })
  if (!mpRes.ok) {
    console.error("[mp/webhook] failed to fetch payment:", await mpRes.text())
    return
  }

  const payment = await mpRes.json()
  if (payment.status !== "approved") return

  // Get configured duration for this plan type
  const { data: plan } = await admin
    .from("membership_plans" as never)
    .select("duration_days")
    .eq("gym_id", gymId)
    .eq("type", membershipType ?? "basic")
    .maybeSingle() as unknown as { data: { duration_days: number } | null }

  const durationDays = plan?.duration_days ?? 30

  // Extend membership from current expiry (or today if expired)
  const { data: profile } = await admin
    .from("profiles")
    .select("membership_expires_at")
    .eq("id", memberId)
    .single()

  const current = profile?.membership_expires_at
    ? new Date(profile.membership_expires_at)
    : new Date()

  const base = current < new Date() ? new Date() : current
  base.setDate(base.getDate() + durationDays)

  await Promise.all([
    admin
      .from("profiles")
      .update({
        membership_expires_at: base.toISOString(),
        ...(membershipType && { membership_type: membershipType }),
      })
      .eq("id", memberId),

    admin.from("payments").insert({
      gym_id: gymId,
      member_id: memberId,
      amount: payment.transaction_amount ?? 0,
      status: "approved",
      mp_payment_id: paymentId,
    }),
  ])
}
