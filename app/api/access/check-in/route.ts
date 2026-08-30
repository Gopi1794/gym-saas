import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { startOfTodayAR } from "@/lib/date-ar"
import {
  hashAccessSecret,
  isProfileAllowedToCheckIn,
  resolveDeviceCheckInMethod,
} from "@/lib/access-control"

type DeviceRow = { id: string; gym_id: string; status: "active" | "disabled" }
type CredentialRow = { member_id: string }
type ProfileRow = { id: string; full_name: string | null; membership_expires_at: string | null; role: string | null }

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") ?? ""
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : ""
    if (!token) return NextResponse.json({ ok: false, reason: "missing_token" }, { status: 401 })

    const body = await req.json().catch(() => null) as { deviceId?: string; credential?: string; input?: string } | null
    const deviceUid = body?.deviceId?.trim()
    const credential = body?.credential?.trim()
    if (!deviceUid || !credential) {
      return NextResponse.json({ ok: false, reason: "invalid_payload" }, { status: 400 })
    }

    const admin = createAdminClient()
    const tokenHash = hashAccessSecret(token)
    const { data: device } = await (admin.from("access_devices" as never) as any)
      .select("id, gym_id, status")
      .eq("device_uid", deviceUid)
      .eq("token_hash", tokenHash)
      .maybeSingle() as { data: DeviceRow | null }

    if (!device) return NextResponse.json({ ok: false, reason: "unknown_device" }, { status: 401 })

    await (admin.from("access_devices" as never) as any)
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", device.id)

    if (device.status !== "active") {
      await recordAccessEvent(admin, {
        gymId: device.gym_id,
        deviceId: device.id,
        result: "disabled_device",
        reason: "device_disabled",
      })
      return NextResponse.json({ ok: false, reason: "disabled_device" }, { status: 403 })
    }

    const credentialHash = hashAccessSecret(credential)
    const { data: accessCredential } = await (admin.from("member_access_credentials" as never) as any)
      .select("member_id")
      .eq("gym_id", device.gym_id)
      .eq("credential_hash", credentialHash)
      .eq("status", "active")
      .maybeSingle() as { data: CredentialRow | null }

    if (!accessCredential) {
      await recordAccessEvent(admin, {
        gymId: device.gym_id,
        deviceId: device.id,
        credentialHash,
        result: "unknown_credential",
        reason: "credential_not_registered",
      })
      return NextResponse.json({ ok: false, reason: "unknown_credential" }, { status: 404 })
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, membership_expires_at, role")
      .eq("id", accessCredential.member_id)
      .eq("gym_id", device.gym_id)
      .maybeSingle() as unknown as { data: ProfileRow | null }

    if (!profile) {
      await recordAccessEvent(admin, {
        gymId: device.gym_id,
        deviceId: device.id,
        memberId: accessCredential.member_id,
        credentialHash,
        result: "rejected",
        reason: "member_not_found",
      })
      return NextResponse.json({ ok: false, reason: "member_not_found" }, { status: 404 })
    }

    if (!isProfileAllowedToCheckIn(profile)) {
      await recordAccessEvent(admin, {
        gymId: device.gym_id,
        deviceId: device.id,
        memberId: profile.id,
        credentialHash,
        result: "expired",
        reason: "membership_expired",
      })
      return NextResponse.json({ ok: false, reason: "membership_expired", memberName: profile.full_name }, { status: 403 })
    }

    const action = await registerDeviceCheckIn(admin, {
      memberId: profile.id,
      gymId: device.gym_id,
      method: resolveDeviceCheckInMethod(body?.input),
    })

    await recordAccessEvent(admin, {
      gymId: device.gym_id,
      deviceId: device.id,
      memberId: profile.id,
      credentialHash,
      result: "accepted",
      reason: action,
    })

    return NextResponse.json({ ok: true, action, memberName: profile.full_name ?? "Socio" })
  } catch (err) {
    console.error("[access/check-in] unhandled error", err)
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 })
  }
}

async function registerDeviceCheckIn(
  admin: ReturnType<typeof createAdminClient>,
  input: { memberId: string; gymId: string; method: "device" | "nfc" },
): Promise<"checkin" | "checkout"> {
  const todayStr = startOfTodayAR()
  const { data: openCheckin } = await (admin.from("check_ins") as any)
    .select("id, checked_in_at")
    .eq("user_id", input.memberId)
    .eq("gym_id", input.gymId)
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (openCheckin) {
    const isToday = openCheckin.checked_in_at >= todayStr
    if (isToday) {
      await (admin.from("check_ins") as any)
        .update({ checked_out_at: new Date().toISOString() })
        .eq("id", openCheckin.id)
      return "checkout"
    }

    const endOfThatDay = new Date(openCheckin.checked_in_at)
    endOfThatDay.setHours(23, 59, 59, 999)
    await (admin.from("check_ins") as any)
      .update({ checked_out_at: endOfThatDay.toISOString() })
      .eq("id", openCheckin.id)
  }

  await (admin.from("check_ins") as any).insert({
    user_id: input.memberId,
    gym_id: input.gymId,
    method: input.method,
    checked_in_at: new Date().toISOString(),
  })

  return "checkin"
}

async function recordAccessEvent(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    gymId: string
    deviceId?: string
    memberId?: string
    credentialHash?: string
    result: "accepted" | "rejected" | "expired" | "unknown_credential" | "disabled_device"
    reason?: string
  },
) {
  await (admin.from("access_events" as never) as any).insert({
    gym_id: input.gymId,
    device_id: input.deviceId ?? null,
    member_id: input.memberId ?? null,
    credential_hash: input.credentialHash ?? null,
    result: input.result,
    reason: input.reason ?? null,
  })
}
