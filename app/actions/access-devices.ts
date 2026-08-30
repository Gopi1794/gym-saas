"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  generateDeviceToken,
  hashAccessSecret,
  normalizeAccessValue,
  type AccessCredentialKind,
} from "@/lib/access-control"

type AdminProfile = { gym_id: string | null; role: string | null }

async function getAdminContext() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" as const }

  const { data: profile } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .single() as unknown as { data: AdminProfile | null }

  if (profile?.role !== "admin") return { error: "Sin permisos" as const }
  if (!profile.gym_id) return { error: "Sin gimnasio" as const }

  return { supabase, gymId: profile.gym_id }
}

export async function createAccessDevice(input: { name: string; deviceUid: string }) {
  const ctx = await getAdminContext()
  if ("error" in ctx) return { error: ctx.error }

  const name = input.name.trim()
  const deviceUid = input.deviceUid.trim()
  if (!name || !deviceUid) return { error: "Nombre y device ID son obligatorios" }

  const token = generateDeviceToken()
  const { error } = await (ctx.supabase.from("access_devices" as never) as any).insert({
    gym_id: ctx.gymId,
    name,
    device_uid: deviceUid,
    token_hash: hashAccessSecret(token),
    status: "active",
  })

  if (error) return { error: error.message }
  revalidatePath("/admin")
  return { success: true, token }
}

export async function setAccessDeviceStatus(deviceId: string, status: "active" | "disabled") {
  const ctx = await getAdminContext()
  if ("error" in ctx) return { error: ctx.error }

  const { error } = await (ctx.supabase.from("access_devices" as never) as any)
    .update({ status })
    .eq("id", deviceId)
    .eq("gym_id", ctx.gymId)

  if (error) return { error: error.message }
  revalidatePath("/admin")
  return { success: true }
}

export async function assignAccessCredential(input: {
  memberId: string
  credential: string
  kind: AccessCredentialKind
  label?: string
}) {
  const ctx = await getAdminContext()
  if ("error" in ctx) return { error: ctx.error }

  const credential = normalizeAccessValue(input.credential)
  if (!input.memberId || !credential) return { error: "Socio y credencial son obligatorios" }

  const { data: member } = await ctx.supabase
    .from("profiles")
    .select("id")
    .eq("id", input.memberId)
    .eq("gym_id", ctx.gymId)
    .single()

  if (!member) return { error: "Socio no encontrado" }

  const { error } = await (ctx.supabase.from("member_access_credentials" as never) as any).insert({
    gym_id: ctx.gymId,
    member_id: input.memberId,
    credential_hash: hashAccessSecret(credential),
    kind: input.kind,
    label: input.label?.trim() || null,
    status: "active",
  })

  if (error) return { error: error.message }
  revalidatePath("/admin")
  return { success: true }
}

export async function setAccessCredentialStatus(credentialId: string, status: "active" | "disabled" | "lost") {
  const ctx = await getAdminContext()
  if ("error" in ctx) return { error: ctx.error }

  const { error } = await (ctx.supabase.from("member_access_credentials" as never) as any)
    .update({ status })
    .eq("id", credentialId)
    .eq("gym_id", ctx.gymId)

  if (error) return { error: error.message }
  revalidatePath("/admin")
  return { success: true }
}
