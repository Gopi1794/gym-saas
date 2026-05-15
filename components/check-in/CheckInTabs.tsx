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

export default function CheckInTabs({
  profile,
  todayCheckIns,
  gymId,
}: CheckInTabsProps) {
  const isAdmin = profile?.role === "admin" || profile?.role === "trainer"

  return (
    <Tabs defaultValue={isAdmin ? "scan" : "qr"} className="space-y-4">
      <TabsList className="border border-border bg-card text-muted-foreground">
        <TabsTrigger value="qr">My QR Code</TabsTrigger>
        {isAdmin && <TabsTrigger value="scan">Scan Member</TabsTrigger>}
        <TabsTrigger value="log">
          Today&apos;s Log
          {todayCheckIns.length > 0 && (
            <span className="ml-1.5 rounded-full bg-brand px-1.5 py-0.5 text-xs text-primary-foreground">
              {todayCheckIns.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="qr">
        <QRCodeDisplay qrCode={profile?.qr_code ?? null} memberName={profile?.full_name ?? null} />
      </TabsContent>

      {isAdmin && (
        <TabsContent value="scan">
          <QRScanner gymId={gymId} />
        </TabsContent>
      )}

      <TabsContent value="log">
        <CheckInLog checkIns={todayCheckIns} />
      </TabsContent>
    </Tabs>
  )
}
