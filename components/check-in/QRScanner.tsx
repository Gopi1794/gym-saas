"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { CheckCircle2, XCircle, Camera } from "lucide-react"
import { cn } from "@/lib/utils"

type ScanStatus = "idle" | "scanning" | "success" | "error"

interface QRScannerProps {
  gymId: string
}

export default function QRScanner({ gymId }: QRScannerProps) {
  const [status, setStatus] = useState<ScanStatus>("idle")
  const [message, setMessage] = useState("")
  const [isStarted, setIsStarted] = useState(false)
  const scannerRef = useRef<unknown>(null)
  const supabase = createClient()

  const handleScan = useCallback(
    async (qrCode: string) => {
      setStatus("scanning")

      // Look up member by QR code
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, membership_expires_at")
        .eq("qr_code", qrCode)
        .single()
      const profile = data as {
        id: string
        full_name: string | null
        membership_expires_at: string | null
      } | null

      if (error || !profile) {
        setStatus("error")
        setMessage("Unknown QR code — member not found")
        return
      }

      // Check membership
      const isActive =
        profile.membership_expires_at &&
        new Date(profile.membership_expires_at) > new Date()

      if (!isActive) {
        setStatus("error")
        setMessage(`${profile.full_name ?? "Member"}'s membership is expired`)
        return
      }

      // Record check-in
      await (supabase.from("check_ins") as any).insert({
        user_id: profile.id,
        gym_id: gymId,
        method: "qr",
      })

      setStatus("success")
      setMessage(`✓ ${profile.full_name ?? "Member"} checked in!`)

      setTimeout(() => setStatus("idle"), 3000)
    },
    [gymId, supabase]
  )

  useEffect(() => {
    if (!isStarted) return

    let scanner: { stop: () => Promise<void>; isScanning: boolean } | null = null

    async function startScanner() {
      const { Html5Qrcode } = await import("html5-qrcode")
      const html5QrCode = new Html5Qrcode("qr-scanner-element")
      scanner = html5QrCode
      scannerRef.current = html5QrCode

      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            if (status === "idle") handleScan(decodedText)
          },
          () => {}
        )
      } catch {
        setStatus("error")
        setMessage("Camera access denied. Please allow camera permissions.")
        setIsStarted(false)
      }
    }

    startScanner()

    return () => {
      if (scanner?.isScanning) {
        scanner.stop().catch(() => {})
      }
    }
  }, [isStarted, handleScan, status])

  return (
    <Card className="mx-auto max-w-sm border-border bg-card">
      <CardContent className="flex flex-col items-center gap-5 p-8">
        <div className="text-center">
          <p className="font-heading text-2xl font-normal tracking-wide text-card-foreground">
            QR Scanner
          </p>
          <p className="text-sm text-muted-foreground">
            Point the camera at a member&apos;s QR code
          </p>
        </div>

        {/* Scanner viewport */}
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-2xl border-2",
            status === "success"
              ? "border-emerald-500"
              : status === "error"
                ? "border-destructive"
                : "border-border"
          )}
          style={{ minHeight: 280 }}
        >
          <div id="qr-scanner-element" className="w-full" />

          {!isStarted && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/90">
              <Camera className="h-12 w-12 text-muted-foreground" />
              <Button
                onClick={() => setIsStarted(true)}
                className="bg-brand text-primary-foreground hover:bg-brand-600"
              >
                Start Camera
              </Button>
            </div>
          )}
        </div>

        {/* Status feedback */}
        {status !== "idle" && message && (
          <div
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-4 py-3",
              status === "success"
                ? "bg-emerald-950/50 text-emerald-400"
                : status === "error"
                  ? "bg-destructive/20 text-destructive-foreground"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {status === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 shrink-0" />
            )}
            <p className="text-sm font-medium">{message}</p>
          </div>
        )}

        {isStarted && (
          <Button
            variant="outline"
            size="sm"
            className="border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              setIsStarted(false)
              setStatus("idle")
              setMessage("")
            }}
          >
            Stop Camera
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
