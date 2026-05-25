"use client";
import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveMpToken } from "@/app/actions/gym-settings";

export default function GymSettingsPanel() {
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(
    null,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const res = await saveMpToken(token);
    setResult(res.error ? { error: res.error } : { ok: true });
    if (!res.error) setToken("");
    setLoading(false);
  }

  return (
    <div className="max-w-xl space-y-6">
      <section className="rounded-lg border border-[#ffec20] overflow-hidden">
        <div className="bg-[#ffec20] px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900">Token de Mercado Pago</h2>
          <img
            src="/MP_RGB_HANDSHAKE_pluma_horizontal.svg"
            alt="Mercado Pago"
            className="h-12 brightness-0"
          />
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-zinc-400">
            Pegá tu Access Token de producción de Mercado Pago. Se guarda
            encriptado y nunca se expone al cliente.
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
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-zinc-800 transition-colors cursor-pointer"
                  aria-label={show ? "Ocultar token" : "Mostrar token"}
                >
                  {show ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            {result?.ok && (
              <p className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Token guardado
                correctamente.
              </p>
            )}
            {result?.error && (
              <p className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4" /> {result.error}
              </p>
            )}
            <Button type="submit" disabled={loading || !token.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar token
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
