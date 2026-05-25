import type { Metadata } from "next"
import GymSettingsPanel from "@/components/admin/GymSettingsPanel"

export const metadata: Metadata = { title: "Configuración" }

export default function GymSettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Configuración del gimnasio</h1>
        <p className="text-sm text-zinc-500 mt-1">Ajustes de integración y pagos.</p>
      </div>
      <GymSettingsPanel />
    </div>
  )
}
