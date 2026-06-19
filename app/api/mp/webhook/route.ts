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

async function getGymWebhookSecret(gymId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.rpc("get_mp_webhook_secret_for_webhook", { p_gym_id: gymId })
  return data ?? null
}

function verifyMpSignature(req: NextRequest, rawBody: string, secret: string): boolean {
  const xSignature = req.headers.get("x-signature") ?? ""
  const xRequestId = req.headers.get("x-request-id") ?? ""

  const parts = Object.fromEntries(xSignature.split(",").map(p => p.split("=")))
  const ts = parts["ts"]
  const v1 = parts["v1"]
  if (!ts || !v1) {
    console.warn("[mp/webhook] ts o v1 ausentes en x-signature")
    return false
  }

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

  // gym_id desde query string — el owner configura su webhook URL como:
  // https://voltia.com/api/mp/webhook?gym_id=SU_GYM_ID
  // Se usa SOLO para buscar el secret. El gym_id real del pago siempre
  // viene de external_reference (firmado por MP).
  const gymIdFromQuery = req.nextUrl.searchParams.get("gym_id")
  if (!gymIdFromQuery) {
    console.warn("[mp/webhook] gym_id ausente en query string")
    return NextResponse.json({ error: "Missing gym_id" }, { status: 400 })
  }

  const secret = await getGymWebhookSecret(gymIdFromQuery)
  if (!secret) {
    console.error(`[mp/webhook] webhook secret no configurado para gym: ${gymIdFromQuery}`)
    return NextResponse.json({ error: "Webhook not configured" }, { status: 401 })
  }

  if (!verifyMpSignature(req, rawBody, secret)) {
    console.warn("[mp/webhook] firma inválida — request rechazado")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
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

type AdminClient = ReturnType<typeof createAdminClient>

async function finalizePayment(
  admin: AdminClient,
  paymentId: string,
  memberId: string,
  gymId: string,
  membershipType: "basic" | "premium" | "vip" | undefined,
  payment: { transaction_amount?: number },
): Promise<void> {
  const { data: plan } = await admin
    .from("membership_plans" as never)
    .select("duration_days")
    .eq("gym_id", gymId)
    .eq("type", membershipType ?? "basic")
    .maybeSingle() as unknown as { data: { duration_days: number } | null }

  const durationDays = plan?.duration_days ?? 30

  const { error } = await admin.rpc("extend_member_membership" as never, {
    p_member_id: memberId,
    p_gym_id: gymId,
    p_payment_id: paymentId,
    p_amount: payment.transaction_amount ?? 0,
    p_membership_type: membershipType ?? "basic",
    p_duration_days: durationDays,
  } as never)

  if (error) {
    console.error("[mp/webhook] error in extend_member_membership:", error)
    return
  }

  console.log(`[mp/webhook] payment ${paymentId} finalized — member ${memberId} extended ${durationDays} days`)

  try {
    const { data: member } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", memberId)
      .maybeSingle()

    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("gym_id", gymId)
      .eq("role", "admin")

    if (admins && admins.length > 0) {
      const amount = payment.transaction_amount ?? 0
      const formatted = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(amount)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from("notifications" as never) as any).insert(
        admins.map((a: { id: string }) => ({
          user_id: a.id,
          gym_id: gymId,
          type: "payment_received",
          title: "Pago recibido 💳",
          body: `${member?.full_name ?? "Un miembro"} pagó ${formatted} (${membershipType ?? "basic"})`,
          data: { member_id: memberId, payment_id: paymentId, amount },
        }))
      )
    }
  } catch (notifErr) {
    console.error("[mp/webhook] error sending admin notification:", notifErr)
  }
}

async function processPayment(paymentId: string, externalRef?: string) {
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("mp_payment_id", paymentId)
    .maybeSingle()

  if (existing) {
    console.log("[mp/webhook] already processed:", paymentId)
    return
  }

  const parts = externalRef?.split("__") ?? []
  const memberId = parts[0]
  const gymId = parts[1]
  const membershipType = parts[2] as "basic" | "premium" | "vip" | undefined

  if (!gymId) {
    console.warn("[mp/webhook] gym_id ausente en external_reference, skipping:", paymentId)
    return
  }

  const { data: mpToken } = await admin.rpc("get_mp_token_for_checkout", { p_gym_id: gymId })
  if (!mpToken) {
    console.warn("[mp/webhook] no mp token for gym:", gymId)
    return
  }

  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mpToken}` },
  })
  if (!mpRes.ok) {
    console.error("[mp/webhook] failed to fetch payment:", await mpRes.text())
    return
  }

  const payment = await mpRes.json()
  if (payment.status !== "approved") {
    console.log("[mp/webhook] payment not approved:", payment.status)
    return
  }

  if (!memberId) {
    const preParts = (payment.external_reference as string | undefined)?.split("__") ?? []
    const resolvedMemberId = preParts[0]
    const resolvedGymId = preParts[1] ?? gymId
    const resolvedType = preParts[2] as "basic" | "premium" | "vip" | undefined

    if (!resolvedMemberId) {
      console.warn("[mp/webhook] no member_id in payment external_reference:", paymentId)
      return
    }

    await finalizePayment(admin, paymentId, resolvedMemberId, resolvedGymId, resolvedType, payment)
    return
  }

  await finalizePayment(admin, paymentId, memberId, gymId, membershipType, payment)
}
