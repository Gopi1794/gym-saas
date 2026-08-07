import { ProfileAvatar } from "@/components/ui/profile-avatar"
import TrainerPaymentAccessToggle from "@/components/staff/TrainerPaymentAccessToggle"

export interface TrainerAccessRow {
  id: string
  full_name: string | null
  avatar_url: string | null
  can_collect_payments: boolean
}

interface Props {
  trainers: TrainerAccessRow[]
}

export default function TrainerPaymentAccessPanel({ trainers }: Props) {
  if (trainers.length === 0) return null

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-lg text-zinc-900 dark:text-white">Permisos de cobro</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Elegí qué trainers pueden cobrar y renovar membresías en efectivo o Mercado Pago manual.
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800 overflow-hidden">
        {trainers.map((trainer) => (
          <div key={trainer.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <ProfileAvatar src={trainer.avatar_url} name={trainer.full_name} size={32} />
              <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {trainer.full_name ?? "Sin nombre"}
              </span>
            </div>
            <TrainerPaymentAccessToggle
              trainerId={trainer.id}
              initialValue={trainer.can_collect_payments}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
