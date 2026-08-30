"use client"

import { useState, useTransition } from "react"
import { Activity, KeyRound, Plus, Radio, UserRound } from "lucide-react"
import { createAccessDevice, assignAccessCredential, setAccessCredentialStatus, setAccessDeviceStatus } from "@/app/actions/access-devices"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type DeviceRow = {
  id: string
  name: string
  device_uid: string
  status: "active" | "disabled"
  last_seen_at: string | null
  created_at: string
}

type MemberRow = { id: string; full_name: string | null }

type CredentialRow = {
  id: string
  kind: "nfc" | "serial_test"
  label: string | null
  status: "active" | "disabled" | "lost"
  created_at: string
  profiles: { full_name: string | null } | null
}

type EventRow = {
  id: string
  result: string
  reason: string | null
  created_at: string
  profiles: { full_name: string | null } | null
  access_devices: { name: string | null; device_uid: string | null } | null
}

interface Props {
  devices: DeviceRow[]
  members: MemberRow[]
  credentials: CredentialRow[]
  events: EventRow[]
}

export default function AccessDevicesPanel({ devices, members, credentials, events }: Props) {
  const [isPending, startTransition] = useTransition()
  const [deviceName, setDeviceName] = useState("Entrada principal")
  const [deviceUid, setDeviceUid] = useState("gymflow-esp32-checkin-001")
  const [memberId, setMemberId] = useState(members[0]?.id ?? "")
  const [credential, setCredential] = useState("12345")
  const [credentialLabel, setCredentialLabel] = useState("Prueba Serial ESP32")
  const [token, setToken] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null)

  function handleCreateDevice() {
    setFeedback(null)
    setToken(null)
    startTransition(async () => {
      const result = await createAccessDevice({ name: deviceName, deviceUid })
      if (result.error) setFeedback({ kind: "error", message: result.error })
      else {
        setToken(result.token ?? null)
        setFeedback({ kind: "success", message: "Dispositivo creado. Copiá el token ahora: no se vuelve a mostrar." })
      }
    })
  }

  function handleAssignCredential() {
    setFeedback(null)
    startTransition(async () => {
      const result = await assignAccessCredential({ memberId, credential, kind: "serial_test", label: credentialLabel })
      if (result.error) setFeedback({ kind: "error", message: result.error })
      else setFeedback({ kind: "success", message: "Credencial asignada" })
    })
  }

  return (
    <div className="space-y-5">
      {feedback && <Alert variant={feedback.kind === "error" ? "error" : "success"}>{feedback.message}</Alert>}
      {token && (
        <Alert variant="warning">
          Token del dispositivo: <code className="ml-1 rounded bg-black/30 px-1 py-0.5">{token}</code>
        </Alert>
      )}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Radio className="h-5 w-5 text-brand" />
          <div>
            <h2 className="font-heading text-xl text-foreground">Dispositivos</h2>
            <p className="text-sm text-muted-foreground">Registrá el ESP32 y controlá si puede tomar check-ins.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input value={deviceName} onChange={e => setDeviceName(e.target.value)} placeholder="Nombre" />
          <Input value={deviceUid} onChange={e => setDeviceUid(e.target.value)} placeholder="Device ID" />
          <Button onClick={handleCreateDevice} disabled={isPending}><Plus className="h-4 w-4" />Crear</Button>
        </div>
        <div className="mt-4 space-y-2">
          {devices.map(device => (
            <div key={device.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-black/20 p-3">
              <div>
                <div className="font-medium text-foreground">{device.name}</div>
                <div className="text-xs text-muted-foreground">{device.device_uid} · Último contacto: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString("es-AR") : "Nunca"}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={device.status === "active" ? "success" : "secondary"}>{device.status}</Badge>
                <Button size="sm" variant="outline" onClick={() => startTransition(() => { void setAccessDeviceStatus(device.id, device.status === "active" ? "disabled" : "active") })}>
                  {device.status === "active" ? "Desactivar" : "Activar"}
                </Button>
              </div>
            </div>
          ))}
          {devices.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay dispositivos.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-brand" />
          <div>
            <h2 className="font-heading text-xl text-foreground">Credenciales</h2>
            <p className="text-sm text-muted-foreground">Por ahora usamos la credencial serial de prueba; después será el UID NFC.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <select value={memberId} onChange={e => setMemberId(e.target.value)} className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-50">
            {members.map(member => <option key={member.id} value={member.id}>{member.full_name ?? "Socio sin nombre"}</option>)}
          </select>
          <Input value={credential} onChange={e => setCredential(e.target.value)} placeholder="Credencial" />
          <Input value={credentialLabel} onChange={e => setCredentialLabel(e.target.value)} placeholder="Etiqueta" />
          <Button onClick={handleAssignCredential} disabled={isPending || !memberId}>Asignar</Button>
        </div>
        <div className="mt-4 space-y-2">
          {credentials.map(row => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-black/20 p-3">
              <div>
                <div className="font-medium text-foreground">{row.profiles?.full_name ?? "Socio"}</div>
                <div className="text-xs text-muted-foreground">{row.label ?? row.kind} · {new Date(row.created_at).toLocaleDateString("es-AR")}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={row.status === "active" ? "success" : row.status === "lost" ? "destructive" : "secondary"}>{row.status}</Badge>
                {row.status === "active" && <Button size="sm" variant="outline" onClick={() => startTransition(() => { void setAccessCredentialStatus(row.id, "disabled") })}>Desactivar</Button>}
                {row.status === "active" && <Button size="sm" variant="destructive" onClick={() => startTransition(() => { void setAccessCredentialStatus(row.id, "lost") })}>Perdida</Button>}
              </div>
            </div>
          ))}
          {credentials.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay credenciales.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-brand" />
          <div>
            <h2 className="font-heading text-xl text-foreground">Últimos eventos</h2>
            <p className="text-sm text-muted-foreground">Auditoría de accesos aceptados y rechazados.</p>
          </div>
        </div>
        <div className="space-y-2">
          {events.map(event => (
            <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-black/20 p-3">
              <div className="flex items-center gap-3">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm text-foreground">{event.profiles?.full_name ?? "Sin socio"}</div>
                  <div className="text-xs text-muted-foreground">{event.access_devices?.name ?? "Dispositivo"} · {event.reason ?? "sin detalle"}</div>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={event.result === "accepted" ? "success" : "warning"}>{event.result}</Badge>
                <div className="mt-1 text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString("es-AR")}</div>
              </div>
            </div>
          ))}
          {events.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay eventos.</p>}
        </div>
      </section>
    </div>
  )
}

