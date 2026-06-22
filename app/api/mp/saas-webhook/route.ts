import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"

function verifySignature(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.MP_SAAS_WEBHOOK_SECRET
  if (!secret) {
    console.error("[saas-webhook] MP_SAAS_WEBHOOK_SECRET no configurado — rechazando request")
    return false
  }

  const xSignature = req.headers.get("x-signature") ?? ""
  const xRequestId = req.headers.get("x-request-id") ?? ""

  const parts = Object.fromEntries(xSignature.split(",").map(p => p.split("=")))
  const ts = parts["ts"]
  const v1 = parts["v1"]
  if (!ts || !v1) return false

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

  if (!verifySignature(req, rawBody)) {
    console.warn("[saas-webhook] firma inválida — request rechazado")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: { type?: string; data?: { id?: string } }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: true })
  }

  if (body?.type !== "payment" || !body?.data?.id) {
    return NextResponse.json({ ok: true })
  }

  try {
    await processSaasPayment(body.data.id)
  } catch (err) {
    console.error("[saas-webhook] error:", err)
  }

  return NextResponse.json({ ok: true })
}

async function processSaasPayment(paymentId: string) {
  const mpToken = process.env.MP_SAAS_ACCESS_TOKEN
  if (!mpToken) {
    console.error("[saas-webhook] MP_SAAS_ACCESS_TOKEN no configurado")
    return
  }

  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mpToken}` },
  })
  if (!mpRes.ok) {
    console.error("[saas-webhook] error al obtener pago:", await mpRes.text())
    return
  }

  const payment = await mpRes.json()
  if (payment.status !== "approved") {
    console.log("[saas-webhook] pago no aprobado:", payment.status)
    return
  }

  // external_reference: "{userId}__saas_monthly__{timestamp}"
  const externalRef: string = payment.external_reference ?? ""
  const parts = externalRef.split("__")
  const userId = parts[0]
  const type = parts[1]

  if (!userId || type !== "saas_monthly") {
    console.warn("[saas-webhook] external_reference inválido:", externalRef)
    return
  }

  const admin = createAdminClient()

  // Idempotencia: si ya tiene gym_id, ignorar
  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id")
    .eq("id", userId)
    .single()

  if (profile?.gym_id) {
    console.log("[saas-webhook] gym ya existe para user:", userId)
    return
  }

  const { data: { user }, error: userError } = await admin.auth.admin.getUserById(userId)
  if (userError || !user) {
    console.error("[saas-webhook] usuario no encontrado:", userId)
    return
  }

  const gymName: string = user.user_metadata?.pending_gym_name ?? "Mi Gimnasio"

  const { error } = await admin.rpc("create_gym_for_owner" as never, {
    p_user_id: userId,
    p_gym_name: gymName,
  } as never)

  if (error) {
    console.error("[saas-webhook] error creando gym:", error)
    return
  }

  console.log(`[saas-webhook] gym "${gymName}" creado para user ${userId} — pago ${paymentId}`)
}
