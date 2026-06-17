"use client";
import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveMpToken } from "@/app/actions/gym-settings";
import { createClient } from "@/lib/supabase/client";

export default function GymSettingsPanel() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  const supabase = createClient();

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setPasswordError("No se pudo obtener el usuario."); setPasswordLoading(false); return; }
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (error) {
      setPasswordError("Contraseña incorrecta.");
      setPasswordLoading(false);
      return;
    }
    setPassword("");
    setUnlocked(true);
    setPasswordLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const res = await saveMpToken(token);
    setResult(res.error ? { error: res.error } : { ok: true });
    if (!res.error) { setToken(""); setUnlocked(false); }
    setLoading(false);
  }

  return (
    <>
      {/* Modal de contraseña */}
      {!unlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-5">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-700/20 border border-brand-700/30">
                <Lock className="h-5 w-5 text-brand-500" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-50">Confirmá tu identidad</h2>
              <p className="text-sm text-zinc-400">Ingresá tu contraseña para modificar el token de Mercado Pago.</p>
            </div>
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Contraseña</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
                  autoFocus
                />
              </div>
              {passwordError && (
                <p className="flex items-center gap-2 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4" /> {passwordError}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={passwordLoading || !password}>
                {passwordLoading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando…</>
                  : "Confirmar"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Panel principal */}
      <div className="max-w-xl space-y-6">
        <section className="rounded-lg border border-[#ffec20] overflow-hidden">
          <div className="bg-[#ffec20] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-zinc-900">Token de Mercado Pago</h2>
              {unlocked && <ShieldCheck className="h-4 w-4 text-emerald-700" />}
            </div>
            <img src="/MP_RGB_HANDSHAKE_pluma_horizontal.svg" alt="Mercado Pago" className="h-12 brightness-0" />
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-zinc-400">
              Pegá tu Access Token de producción de Mercado Pago. Se guarda encriptado y nunca se expone al cliente.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mp-token">Access Token</Label>
                <div className="relative">
                  <Input
                    id="mp-token"
                    type={show ? "text" : "password"}
                    placeholder="APP_USR-..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="pr-10 font-mono text-sm"
                    disabled={!unlocked}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-zinc-800 transition-colors cursor-pointer"
                    aria-label={show ? "Ocultar token" : "Mostrar token"}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {result?.ok && (
                <p className="flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Token guardado correctamente.
                </p>
              )}
              {result?.error && (
                <p className="flex items-center gap-2 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4" /> {result.error}
                </p>
              )}
              <Button type="submit" disabled={loading || !token.trim() || !unlocked}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar token
              </Button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
