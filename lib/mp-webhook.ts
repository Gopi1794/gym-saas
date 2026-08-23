import { resolveActionableMpStatus } from "./payments"

export type MembershipType = "basic" | "premium" | "vip"
export type MpPaymentAction = NonNullable<ReturnType<typeof resolveActionableMpStatus>>

export interface MpExternalReferenceParts {
  memberId?: string
  gymId?: string
  membershipType?: MembershipType
}

export interface MpPaymentProcessingPlan extends Required<MpExternalReferenceParts> {
  action: MpPaymentAction
  checkoutExternalReference?: string
}

function asMembershipType(value: string | undefined): MembershipType | undefined {
  if (value === "basic" || value === "premium" || value === "vip") return value
  return undefined
}

export function parseMpExternalReference(externalReference: string | undefined): MpExternalReferenceParts {
  const [memberId, gymId, membershipType] = externalReference?.split("__") ?? []
  return {
    memberId: memberId || undefined,
    gymId: gymId || undefined,
    membershipType: asMembershipType(membershipType),
  }
}

export function resolveMpPaymentProcessingPlan({
  status,
  notificationExternalReference,
  paymentExternalReference,
}: {
  status: string
  notificationExternalReference?: string
  paymentExternalReference?: string
}): MpPaymentProcessingPlan | null {
  const action = resolveActionableMpStatus(status)
  if (action === null) return null

  const notificationRef = parseMpExternalReference(notificationExternalReference)
  const paymentRef = parseMpExternalReference(paymentExternalReference)

  const memberId = notificationRef.memberId ?? paymentRef.memberId
  const gymId = notificationRef.gymId ?? paymentRef.gymId
  const membershipType = notificationRef.membershipType ?? paymentRef.membershipType ?? "basic"

  if (!memberId || !gymId) return null

  return {
    action,
    memberId,
    gymId,
    membershipType,
    checkoutExternalReference: paymentExternalReference ?? notificationExternalReference,
  }
}
