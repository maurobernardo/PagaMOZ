"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";
import { csrfToken } from "@/lib/api";

type Result = { level: "alto" | "medio" | "baixo"; reasons: string[]; summary: string; tip: string };

/** "Isto é burla?": cola-se a mensagem recebida e mostram-se os sinais de fraude, com o motivo de cada um. */
export function ScamCheck() {
  const [text, setText] = useState("");
  const [r, setR] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/intel/scam-check", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken() }, body: JSON.stringify({ message: text }) });
      if (res.ok) setR(await res.json());
    } finally {
      setBusy(false);
    }
  }

  const tone = r ? { alto: "border-accent text-accent", medio: "border-amber-600 text-amber-700", baixo: "border-emerald-600 text-emerald-700" }[r.level] : "";
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-white p-6 sm:p-8">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-canvas"><ShieldAlert className="h-5 w-5" /></span>
      <h2 className="mt-5 text-2xl font-bold">Isto é burla?</h2>
      <p className="mt-1 text-sm text-muted">Cole a mensagem que recebeu (SMS ou WhatsApp). Mostramos os sinais de fraude.</p>
      <form onSubmit={check} className="mt-5 space-y-3">
        <label htmlFor="scam" className="sr-only">Mensagem recebida</label>
        <textarea id="scam" value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Cole aqui a mensagem…"
          className="block w-full rounded-2xl border border-line p-4 text-base focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/5" />
        <Button type="submit" disabled={busy || text.trim().length < 5} className="w-full !min-h-12"><ShieldCheck className="h-4 w-4" /> Verificar mensagem</Button>
      </form>
      {r ? (
        <div className={`mt-5 rounded-2xl border-2 p-4 ${tone}`}>
          <p className="flex items-center gap-2 font-bold">{r.level === "baixo" ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />} {r.summary}</p>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            {r.reasons.map((x) => <li key={x} className="flex gap-2"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />{x}</li>)}
          </ul>
          <p className="mt-3 text-sm text-muted">{r.tip}</p>
        </div>
      ) : null}
    </section>
  );
}
