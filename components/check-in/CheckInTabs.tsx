"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import QRCodeDisplay from "./QRCodeDisplay"
import QRScanner from "./QRScanner"
import CheckInLog from "./CheckInLog"
import type { Profile } from "@/types"

interface CheckInRow {
  id: string
  checked_in_at: string
  method: string
  profiles: {
    full_name: string | null
    avatar_url: string | null
    membership_type: string | null
  } | null
}

interface CheckInTabsProps {
  profile: Profile | null
  todayCheckIns: CheckInRow[]
  gymId: string
}

export default function CheckInTabs({ profile, todayCheckIns, gymId }: CheckInTabsProps) {
  const role = profile?.role ?? "member"
  const isAdmin = role === "admin"
  const isStaff = role === "admin" || role === "trainer"
  const gymQrValue = `GYM_CHECKIN:${gymId}`

  return (
    <Tabs defaultValue={isStaff ? "scan" : "qr"} className="space-y-4">
      <TabsList className="w-full border border-border bg-card text-muted-foreground">
        {isAdmin && <TabsTrigger value="gym-qr" className="flex-1">QR del Gym</TabsTrigger>}
        {!isAdmin && <TabsTrigger value="qr" className="flex-1">Mi QR</TabsTrigger>}
        {isStaff && <TabsTrigger value="scan" className="flex-1">Escanear</TabsTrigger>}

        <TabsTrigger value="log" className="flex-1">
          Registro de hoy
          {todayCheckIns.length > 0 && (
            <span className="ml-1.5 rounded-full bg-brand px-1.5 py-0.5 text-xs text-primary-foreground">
              {todayCheckIns.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      {isAdmin && (
        <TabsContent value="gym-qr">
          <QRCodeDisplay qrCode={gymQrValue} memberName="QR del Establecimiento" />
        </TabsContent>
      )}

      {!isAdmin && (
        <TabsContent value="qr">
          <QRCodeDisplay qrCode={profile?.qr_code ?? null} memberName={profile?.full_name ?? null} />
        </TabsContent>
      )}

      {isStaff && (
        <TabsContent value="scan">
          <QRScanner gymId={gymId} userId={profile?.id ?? ""} userRole={role} />
        </TabsContent>
      )}

<TabsContent value="log">
        <CheckInLog checkIns={todayCheckIns} />
      </TabsContent>
    </Tabs>
  )
}
