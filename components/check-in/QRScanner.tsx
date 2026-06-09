"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { startOfTodayAR } from "@/lib/date-ar"
import { CheckCircle2, XCircle, Camera } from "lucide-react"
import { cn } from "@/lib/utils"

type ScanStatus = "idle" | "scanning" | "success" | "error"

interface QRScannerProps {
  gymId: string
  userId: string
  userRole: string
}

export default function QRScanner({ gymId, userId, userRole }: QRScannerProps) {
  const router = useRouter()
  const [status, setStatus] = useState<ScanStatus>("idle")
  const [message, setMessage] = useState("")
  const [isStarted, setIsStarted] = useState(false)
  const scannerRef = useRef<unknown>(null)
  // Ref en lugar de state para evitar stale closure dentro del callback del scanner
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
      setStatus("scanning")

      const supabase = supabaseRef.current
      const todayStr = startOfTodayAR()
      console.log("[QRScanner] todayStr (AR midnight UTC):", todayStr)

      // Trainer/admin escaneando el QR del establecimiento → ficha entrada o salida
      if (qrCode === `GYM_CHECKIN:${gymId}`) {
        if (userRole !== "trainer" && userRole !== "admin") {
          setStatus("error")
          setMessage("Solo el staff puede fichar con el QR del establecimiento")
          setTimeout(() => { setStatus("idle"); processingRef.current = false }, 3000)
          return
        }

        // Buscar si ya tiene un check-in hoy
        const { data: existing } = await (supabase.from("check_ins") as any)
          .select("id, checked_out_at")
          .eq("user_id", userId)
          .gte("checked_in_at", todayStr)
          .order("checked_in_at", { ascending: false })
          .limit(1)
          .single()

        // Ya fichó entrada y aún no tiene salida → registrar salida
        if (existing && !existing.checked_out_at) {
          const { error: outErr } = await (supabase.from("check_ins") as any)
            .update({ checked_out_at: new Date().toISOString() })
            .eq("id", existing.id)
          if (outErr) {
            setStatus("error")
            setMessage(`Error al registrar salida: ${outErr.message}`)
            setTimeout(() => { setStatus("idle"); processingRef.current = false }, 3000)
            return
          }
          stopCamera()
          setStatus("success")
          setMessage("✓ Salida fichada correctamente")
          router.refresh()
          setTimeout(() => { setStatus("idle"); processingRef.current = false }, 3000)
          return
        }

        // Ya fichó entrada y salida → jornada completa
        if (existing && existing.checked_out_at) {
          setStatus("error")
          setMessage("Ya registraste entrada y salida hoy")
          setTimeout(() => { setStatus("idle"); processingRef.current = false }, 3000)
          return
        }

        // Sin check-in previo → registrar entrada
        const { error: insertErr } = await (supabase.from("check_ins") as any).insert({
          user_id: userId,
          gym_id: gymId,
          method: "qr",
          checked_in_at: new Date().toISOString(),
        })
        if (insertErr) {
          setStatus("error")
          setMessage(`Error al fichar: ${insertErr.message}`)
          setTimeout(() => { setStatus("idle"); processingRef.current = false }, 3000)
          return
        }
        stopCamera()
        setStatus("success")
        setMessage("✓ Entrada fichada correctamente")
        router.refresh()
        setTimeout(() => { setStatus("idle"); processingRef.current = false }, 3000)
        return
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, membership_expires_at, role")
        .eq("qr_code", qrCode)
        .single()
      const profile = data as {
        id: string
        full_name: string | null
        membership_expires_at: string | null
        role: string | null
      } | null

      if (error || !profile) {
        stopCamera()
        setStatus("error")
        setMessage("Código QR desconocido — usuario no encontrado")
        setTimeout(() => { setStatus("idle"); processingRef.current = false }, 3000)
        return
      }

      const isStaff = profile.role === "admin" || profile.role === "trainer"
      const isActive =
        isStaff ||
        (profile.membership_expires_at &&
          new Date(profile.membership_expires_at) > new Date())

      if (!isActive) {
        stopCamera()
        setStatus("error")
        setMessage(`La membresía de ${profile.full_name ?? "el socio"} está vencida`)
        setTimeout(() => { setStatus("idle"); processingRef.current = false }, 3000)
        return
      }

      // Buscar cualquier check-in abierto (sin checkout) para este socio y gym
      const { data: openCheckin, error: openErr } = await (supabase.from("check_ins") as any)
        .select("id, checked_in_at")
        .eq("user_id", profile.id)
        .eq("gym_id", gymId)
        .is("checked_out_at", null)
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      console.log("[QRScanner] profile.id:", profile.id, "gymId:", gymId)
      console.log("[QRScanner] openCheckin:", openCheckin, "error:", openErr)

      if (openCheckin) {
        const isToday = openCheckin.checked_in_at >= todayStr
        console.log("[QRScanner] openCheckin.checked_in_at:", openCheckin.checked_in_at, "isToday:", isToday)
        if (isToday) {
          stopCamera()
          setStatus("error")
          setMessage(`${profile.full_name ?? "Este socio"} ya registró su ingreso hoy`)
          setTimeout(() => { setStatus("idle"); processingRef.current = false }, 3000)
          return
        }
        // Check-in abierto de un día anterior — cerrarlo antes de crear uno nuevo
        await (supabase.from("check_ins") as any)
          .update({ checked_out_at: new Date().toISOString() })
          .eq("id", openCheckin.id)
      }

      const { error: insertError } = await (supabase.from("check_ins") as any).insert({
        user_id: profile.id,
        gym_id: gymId,
        method: "qr",
        checked_in_at: new Date().toISOString(),
      })

      if (insertError) {
        console.log("[QRScanner] insertError:", insertError.code, insertError.message)
        stopCamera()
        setStatus("error")
        const isDuplicate = insertError.code === "23505" || insertError.message?.includes("duplicate")
        setMessage(isDuplicate
          ? `${profile.full_name ?? "Este socio"} ya registró su ingreso hoy`
          : `Error al registrar: ${insertError.message}`
        )
        setTimeout(() => { setStatus("idle"); processingRef.current = false }, 3000)
        return
      }

      stopCamera()
      setStatus("success")
      setMessage(`✓ ${profile.full_name ?? "Socio"} registró su ingreso`)
      router.refresh()

      setTimeout(() => { setStatus("idle"); processingRef.current = false }, 3000)
    },
    [gymId, stopCamera]
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
        // Cámara trasera no disponible — reintentar sin restricción de facingMode
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
            setStatus("error")
            setMessage(msg)
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
        setStatus("error")
        setMessage(msg)
        setIsStarted(false)
      }
    }

    startScanner()

    return () => {
      if (scanner?.isScanning) {
        scanner.stop().catch(() => {})
      }
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
