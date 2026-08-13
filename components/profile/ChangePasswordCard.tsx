"use client"

import { useState } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/client"

interface Props {
  email: string
}

const INPUT_CLASS =
  "bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-50 dark:placeholder:text-zinc-500"

export default function ChangePasswordCard({ email }: Props) {
  const [editing, setEditing] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPasswords, setShowPasswords] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  function resetForm() {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError("La contraseña nueva debe tener al menos 8 caracteres.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden.")
      return
    }

    setLoading(true)

    // Re-verificar la contraseña actual antes de cambiarla — updateUser()
    // no la pide, así que sin este paso cualquiera con la sesión abierta
    // (ej. laptop desbloqueada) podría cambiarla sin saber la actual.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })

    if (reauthError) {
      setError("La contraseña actual es incorrecta.")
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

    setLoading(false)

    if (updateError) {
      setError("No se pudo actualizar la contraseña. Intentá de nuevo.")
      return
    }

    resetForm()
    setEditing(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">Contraseña</p>
          {success && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Actualizada
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing((v) => !v)
            resetForm()
          }}
          className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
        >
          {editing ? "Cancelar" : "Cambiar"}
        </button>
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div role="alert" aria-live="assertive">
              <Alert variant="error">{error}</Alert>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="current-password" className="text-zinc-700 dark:text-zinc-300">
              Contraseña actual
            </Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={`${INPUT_CLASS} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPasswords((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                aria-label={showPasswords ? "Ocultar contraseñas" : "Mostrar contraseñas"}
              >
                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-zinc-700 dark:text-zinc-300">
              Contraseña nueva
            </Label>
            <Input
              id="new-password"
              type={showPasswords ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              required
              className={INPUT_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-zinc-700 dark:text-zinc-300">
              Confirmá la contraseña nueva
            </Label>
            <Input
              id="confirm-password"
              type={showPasswords ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              className={INPUT_CLASS}
            />
          </div>

          <Button
            type="submit"
            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
            className="w-full bg-brand-700 text-white hover:bg-brand-800"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Guardar contraseña"
            )}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">••••••••</p>
      )}
    </div>
  )
}
