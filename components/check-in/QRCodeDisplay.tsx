"use client"

import { useEffect, useRef, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Card, CardContent } from "@/components/ui/card"
import { Download, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface QRCodeDisplayProps {
  qrCode: string | null
  memberName: string | null
}

export default function QRCodeDisplay({ qrCode, memberName }: QRCodeDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Acquire wake lock so the screen stays bright while QR is visible
  useEffect(() => {
    if (!("wakeLock" in navigator)) return

    navigator.wakeLock.request("screen").then((lock) => {
      wakeLockRef.current = lock
    }).catch(() => { /* permission denied or not supported */ })

    return () => {
      wakeLockRef.current?.release()
    }
  }, [])

  // Re-acquire wake lock if page becomes visible again (e.g. tab switch)
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        navigator.wakeLock?.request("screen").then((lock) => {
          wakeLockRef.current = lock
        }).catch(() => {})
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [])

  // Sync fullscreen state with browser events
  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", onFsChange)
    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [])

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  }

  function downloadQR() {
    if (!qrCode) return

    const svg = containerRef.current?.querySelector("svg")
    if (!svg) return
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `gymflow-qr-${qrCode.slice(0, 8)}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card className="mx-auto max-w-sm border-border bg-card">
      <CardContent className="flex flex-col items-center gap-5 p-8">
        <div>
          <p className="text-center text-sm text-muted-foreground">
            Show this QR code at the gym entrance
          </p>
          <p className="text-center font-heading text-2xl font-normal tracking-wide text-card-foreground">
            {memberName ?? "Member"}
          </p>
        </div>

        {/* QR Code — also the fullscreen target */}
        <div
          ref={containerRef}
          className="flex items-center justify-center rounded-2xl bg-white p-4 shadow-lg shadow-brand-950/30"
          style={isFullscreen ? { width: "100vw", height: "100vh", borderRadius: 0 } : undefined}
        >
          {qrCode ? (
            <QRCodeSVG
              value={qrCode}
              size={isFullscreen ? 320 : 220}
              level="H"
              includeMargin={false}
            />
          ) : (
            <div className="flex h-[220px] w-[220px] items-center justify-center text-center text-sm text-muted-foreground">
              QR code unavailable
            </div>
          )}
        </div>

        <p className="font-mono text-xs text-muted-foreground">{qrCode ?? "No QR code assigned"}</p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={downloadQR}
            disabled={!qrCode}
          >
            <Download className="mr-2 h-4 w-4" />
            Download QR
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={toggleFullscreen}
          >
            {isFullscreen
              ? <Minimize2 className="mr-2 h-4 w-4" />
              : <Maximize2 className="mr-2 h-4 w-4" />}
            {isFullscreen ? "Exit" : "Fullscreen"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
