"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { startOfTodayAR } from "@/lib/date-ar"
import { registerMemberCheckIn } from "@/app/actions/check-in"
import { showToast } from "nextjs-toast-notify"
import { Camera } from "lucide-react"

interface QRScannerProps {
  gymId: string
  userId: string
  userRole: string
}

export default function QRScanner({ gymId, userId, userRole }: QRScannerProps) {
  const router = useRouter()
  const [isStarted, setIsStarted] = useState(false)
  const scannerRef = useRef<unknown>(null)
  const processingRef = useRef(false)
  const supabaseRef = useRef(createClient())

  const stopCamera = useCallback(() => {
    const sc = scannerRef.current as { stop: () => Promise<void>; isScanning: boolean } | null
    if (sc?.isScanning) sc.stop().catch(() => {})
    setIsStarted(false)
  }, [])

  const handleScan = useCallback(
    async (qrCode: string) => {
      if (processingRef.current) return
      processingRef.current = true

      const supabase = supabaseRef.current
      const todayStr = startOfTodayAR()

      // Staff escaneando el QR del establecimiento → ficha entrada o salida propia
      if (qrCode === `GYM_CHECKIN:${gymId}`) {
        if (userRole !== "trainer" && userRole !== "admin") {
          stopCamera()
          showToast.error("Solo el staff puede fichar con el QR del establecimiento", {
            duration: 3000, position: "top-right",
          })
          processingRef.current = false
          return
        }

        const { data: existing } = await (supabase.from("check_ins") as any)
          .select("id, checked_out_at")
          .eq("user_id", userId)
          .gte("checked_in_at", todayStr)
          .order("checked_in_at", { ascending: false })
          .limit(1)
          .single()

        if (existing && !existing.checked_out_at) {
          const { error: outErr } = await (supabase.from("check_ins") as any)
            .update({ checked_out_at: new Date().toISOString() })
            .eq("id", existing.id)
          stopCamera()
          if (outErr) {
            showToast.error(`Error al registrar salida: ${outErr.message}`, { duration: 3000, position: "top-right" })
          } else {
            showToast.success("Salida fichada correctamente", { duration: 3000, position: "top-right", transition: "bounceIn" })
            router.refresh()
          }
          processingRef.current = false
          return
        }

        if (existing && existing.checked_out_at) {
          stopCamera()
          showToast.error("Ya registraste entrada y salida hoy", { duration: 3000, position: "top-right" })
          processingRef.current = false
          return
        }

        const { error: insertErr } = await (supabase.from("check_ins") as any).insert({
          user_id: userId,
          gym_id: gymId,
          method: "qr",
          checked_in_at: new Date().toISOString(),
        })
        stopCamera()
        if (insertErr) {
          showToast.error(`Error al fichar: ${insertErr.message}`, { duration: 3000, position: "top-right" })
        } else {
          showToast.success("Entrada fichada correctamente", { duration: 3000, position: "top-right", transition: "bounceIn" })
          router.refresh()
        }
        processingRef.current = false
        return
      }

      // QR de socio → toggle ingreso/salida via server action
      const result = await registerMemberCheckIn(qrCode, gymId)
      stopCamera()

      if (!result.success) {
        const name = result.memberName ?? "Este socio"
        const msg =
          result.reason === "not_found"
            ? "Código QR desconocido — usuario no encontrado"
            : result.reason === "membership_expired"
              ? `La membresía de ${name} está vencida`
              : `Error al registrar: ${result.message ?? "error desconocido"}`
        showToast.error(msg, { duration: 3500, position: "top-right" })
      } else {
        const msg = result.action === "checkout"
          ? `${result.memberName} registró su salida`
          : `${result.memberName} registró su ingreso`
        showToast.success(msg, { duration: 3000, position: "top-right", transition: "bounceIn" })
        router.refresh()
      }

      processingRef.current = false
    },
    [gymId, userId, userRole, stopCamera]
  )

  useEffect(() => {
    if (!isStarted) return

    let scanner: { stop: () => Promise<void>; isScanning: boolean } | null = null

    async function startScanner() {
      const { Html5Qrcode } = await import("html5-qrcode")
      const html5QrCode = new Html5Qrcode("qr-scanner-element")
      scanner = html5QrCode
      scannerRef.current = html5QrCode

      const onScan = (decodedText: string) => {
        if (!processingRef.current) handleScan(decodedText)
      }
      const config = { fps: 10, qrbox: { width: 250, height: 250 } }

      try {
        await html5QrCode.start({ facingMode: "environment" }, config, onScan, () => {})
      } catch (firstErr) {
        const name = (firstErr as { name?: string })?.name ?? ""
        if (name === "OverconstrainedError" || name === "NotFoundError" || String(firstErr).includes("facingMode")) {
          try {
            await html5QrCode.start({ facingMode: "user" }, config, onScan, () => {})
          } catch (secondErr) {
            const n2 = (secondErr as { name?: string })?.name ?? ""
            const msg =
              n2 === "NotAllowedError"
                ? "Permiso denegado. Habilitá la cámara en la configuración del navegador."
                : !window.isSecureContext
                  ? "Se requiere HTTPS para acceder a la cámara."
                  : `Error de cámara: ${n2 || String(secondErr)}`
            showToast.error(msg, { duration: 4000, position: "top-right" })
            setIsStarted(false)
          }
          return
        }
        const msg =
          name === "NotAllowedError"
            ? "Permiso denegado. Habilitá la cámara en la configuración del navegador."
            : name === "NotFoundError"
              ? "No se encontró ninguna cámara en este dispositivo."
              : name === "NotReadableError"
                ? "La cámara está siendo usada por otra app."
                : !window.isSecureContext
                  ? "Se requiere HTTPS para acceder a la cámara."
                  : `Error de cámara: ${name || String(firstErr)}`
        showToast.error(msg, { duration: 4000, position: "top-right" })
        setIsStarted(false)
      }
    }

    startScanner()

    return () => {
      if (scanner?.isScanning) scanner.stop().catch(() => {})
    }
  }, [isStarted, handleScan])

  return (
    <Card className="mx-auto max-w-sm border-border bg-card">
      <CardContent className="flex flex-col items-center gap-5 p-8">
        <div className="text-center">
          <p className="font-heading text-2xl font-normal tracking-wide text-card-foreground">
            QR Scanner
          </p>
          <p className="text-sm text-muted-foreground">
            Apuntá la cámara al QR del socio
          </p>
        </div>

        <div className="relative w-full overflow-hidden rounded-2xl border-2 border-border" style={{ minHeight: 280 }}>
          <div id="qr-scanner-element" className="w-full" />
          {!isStarted && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/90">
              <Camera className="h-12 w-12 text-muted-foreground" />
              <Button
                onClick={() => setIsStarted(true)}
                className="bg-brand text-primary-foreground hover:bg-brand-600"
              >
                Iniciar cámara
              </Button>
            </div>
          )}
        </div>

        {isStarted && (
          <Button
            variant="outline"
            size="sm"
            className="border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={stopCamera}
          >
            Detener cámara
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
