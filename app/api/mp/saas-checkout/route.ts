import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const mpToken = process.env.MP_SAAS_ACCESS_TOKEN
  if (!mpToken) return NextResponse.json({ error: "Token SaaS no configurado" }, { status: 500 })

  const rawUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const appUrl = rawUrl.replace(/\/$/, "")
  const isLocalhost = appUrl.startsWith("http://localhost")
  const externalRef = `${user.id}__saas_monthly__${Date.now()}`

  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mpToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          title: "Voltia — Suscripción mensual",
          quantity: 1,
          unit_price: 100,
          currency_id: "ARS",
        },
      ],
      back_urls: {
        success: `${appUrl}/dashboard`,
        failure: `${appUrl}/onboarding/pago`,
        pending: `${appUrl}/onboarding/pago`,
      },
      ...(!isLocalhost && { auto_return: "approved" }),
      external_reference: externalRef,
      notification_url: `${appUrl}/api/mp/saas-webhook`,
    }),
  })

  if (!mpRes.ok) {
    const err = await mpRes.text()
    console.error("[saas-checkout] MP error:", err)
    return NextResponse.json({ error: "Error al crear preferencia de pago" }, { status: 502 })
  }

  const preference = await mpRes.json()
  return NextResponse.json({ checkout_url: preference.init_point })
}
