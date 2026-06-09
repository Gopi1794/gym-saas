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
    }).catch(() => {})
    return () => { wakeLockRef.current?.release() }
  }, [])

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

  // Lock body scroll when our CSS overlay is active
  useEffect(() => {
    document.body.style.overflow = isFullscreen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [isFullscreen])

  function toggleFullscreen() {
    setIsFullscreen((prev) => !prev)
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
    <>
      {/* CSS fullscreen overlay — works on iOS Safari too */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-white"
          onClick={toggleFullscreen}
        >
          <p className="font-heading text-2xl font-normal tracking-wide text-zinc-900">
            {memberName ?? "Member"}
          </p>
          <div ref={containerRef} className="rounded-2xl bg-white p-4 shadow-xl">
            {qrCode && (
              <QRCodeSVG value={qrCode} size={280} level="H" includeMargin={false} />
            )}
          </div>
          <p className="text-sm text-zinc-400">Tocá para cerrar</p>
        </div>
      )}

      <Card className="mx-auto max-w-sm border-border bg-card">
        <CardContent className="flex flex-col items-center gap-5 p-8">
          <div>
            <p className="text-center text-sm text-muted-foreground">
              Mostrá este QR en la entrada del gimnasio
            </p>
            <p className="text-center font-heading text-2xl font-normal tracking-wide text-card-foreground">
              {memberName ?? "Miembro"}
            </p>
          </div>

          <div
            ref={containerRef}
            className="flex items-center justify-center rounded-2xl bg-white p-4 shadow-lg shadow-brand-950/30"
          >
            {qrCode ? (
              <QRCodeSVG value={qrCode} size={220} level="H" includeMargin={false} />
            ) : (
              <div className="flex h-[220px] w-[220px] items-center justify-center text-center text-sm text-muted-foreground">
                QR no disponible
              </div>
            )}
          </div>

          <p className="font-mono text-xs text-muted-foreground">{qrCode ?? "Sin QR asignado"}</p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={downloadQR}
              disabled={!qrCode}
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={toggleFullscreen}
            >
              <Maximize2 className="mr-2 h-4 w-4" />
              Pantalla completa
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
