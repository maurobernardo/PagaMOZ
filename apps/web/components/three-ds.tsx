"use client";

import { KeyRound, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage, type Payment } from "@/lib/api";
import { Alert, Button } from "./ui";

/** Desafio 3-D Secure do banco emissor: código de 6 dígitos, três tentativas. */
export function ThreeDS({ p, onDone }: { p: Payment; onDone: (p: Payment) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      setDemo(sessionStorage.getItem(`pagamoz-3ds:${p.reference}`) ?? "");
    } catch {
      setDemo("");
    }
    ref.current?.focus();
  }, [p.reference]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await api.POST("/api/payments/{reference}/3ds", { params: { path: { reference: p.reference } }, body: { code } });
    setBusy(false);
    if (!r.data) {
      setCode("");
      return setError(errorMessage(r.error));
    }
    onDone(r.data);
  }

  return (
    <section className="mt-4 rounded-[2rem] border-2 border-ink bg-white p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-white"><ShieldCheck className="h-5 w-5" /></span>
        <div>
          <h2 className="text-lg font-bold">Verificação do seu banco</h2>
          <p className="text-sm text-muted">{p.card_brand ? `${p.card_brand.toUpperCase()} •••• ${p.card_last4}` : "Cartão"} · 3-D Secure</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-ink/80">O banco emissor enviou um código de 6 dígitos para o telemóvel associado ao cartão.</p>
      {demo ? (
        <div className="glass mt-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm">
          <KeyRound className="h-4 w-4 shrink-0 text-accent" /> Demonstração: o código é <strong className="font-mono text-base tracking-widest">{demo}</strong>
        </div>
      ) : null}
      <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
        {error ? <Alert>{error}</Alert> : null}
        <label htmlFor="code-3ds" className="sr-only">Código 3-D Secure</label>
        <input ref={ref} id="code-3ds" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} placeholder="••••••"
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="block min-h-16 w-full rounded-2xl border border-line text-center font-mono text-3xl tracking-[0.6em] placeholder:text-line focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/5" />
        <Button type="submit" disabled={busy || code.length !== 6} className="w-full !min-h-12">{busy ? "A confirmar…" : "Confirmar pagamento"}</Button>
      </form>
    </section>
  );
}
