import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

interface CheckoutBody {
  title: string
  amount: number
  membership_type: "basic" | "premium" | "vip"
}

export async function POST(req: NextRequest) {
  try {
    return await handleCheckout(req)
  } catch (err) {
    console.error("[mp/checkout] unhandled error:", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

async function handleCheckout(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const body: CheckoutBody = await req.json()
  const VALID_TYPES: CheckoutBody["membership_type"][] = ["basic", "premium", "vip"]
  if (!body.title || !body.amount || body.amount <= 0 || !VALID_TYPES.includes(body.membership_type)) {
    return NextResponse.json({ error: "Datos de pago inválidos" }, { status: 400 })
  }

  // Get the user's gym
  const { data: profile } = await supabase
    .from("profiles")
    .select("gym_id")
    .eq("id", user.id)
    .single()

  if (!profile?.gym_id) {
    return NextResponse.json({ error: "El usuario no pertenece a ningún gimnasio" }, { status: 400 })
  }

  // Get mp_access_token via service role (bypasses RLS, vault-decrypted)
  const admin = createAdminClient()
  const { data: mpToken, error: tokenError } = await admin.rpc("get_mp_token_for_checkout", {
    p_gym_id: profile.gym_id,
  })

  if (tokenError) {
    console.error("[mp/checkout] vault error:", tokenError)
    return NextResponse.json({ error: `Vault error: ${tokenError.message}` }, { status: 422 })
  }
  if (!mpToken) {
    console.error("[mp/checkout] no token for gym:", profile.gym_id)
    return NextResponse.json({ error: "El gimnasio no tiene configurado el token de Mercado Pago" }, { status: 422 })
  }

  const rawUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  const appUrl = rawUrl.replace(/\/$/, "")
  const isLocalhost = appUrl.startsWith("http://localhost")
  const externalRef = `${user.id}__${profile.gym_id}__${body.membership_type}__${Date.now()}`

  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mpToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          title: body.title,
          quantity: 1,
          unit_price: body.amount,
          currency_id: "ARS",
        },
      ],
      back_urls: {
        success: `${appUrl}/pagos/success`,
        failure: `${appUrl}/pagos/failure`,
        pending: `${appUrl}/pagos/pending`,
      },
      ...(!isLocalhost && { auto_return: "approved" }),
      external_reference: externalRef,
      notification_url: `${appUrl}/api/mp/webhook?gym_id=${profile.gym_id}`,
    }),
  })

  if (!mpRes.ok) {
    const err = await mpRes.text()
    console.error("MP preference error:", err)
    return NextResponse.json({ error: "Error al crear la preferencia de pago" }, { status: 502 })
  }

  const preference = await mpRes.json()

  return NextResponse.json({
    checkout_url: preference.init_point,
    preference_id: preference.id,
    external_reference: externalRef,
  })
}
