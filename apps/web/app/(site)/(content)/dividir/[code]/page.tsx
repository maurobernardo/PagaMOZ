"use client";

import { CheckCircle2, Clock3, Copy, Share2, Users } from "lucide-react";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { useToast } from "@/components/toast";
import { formatMZN } from "@/lib/i18n";

type Share = { id: number; position: number; name: string; amount: number; state: "por_pagar" | "a_pagar" | "pago"; reference: string | null };
type Split = { code: string; title: string; total: number; paid: number; service: number; service_name: string; institution_name: string; fields: Record<string, string>; shares: Share[] };

/** Conta dividida: quem já pagou, quanto falta, e um link para cada pessoa pagar a sua parte. */
export default function Dividir({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const toast = useToast();
  const [d, setD] = useState<Split | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    fetch(`/api/splits/${code}`).then(async (r) => (r.ok ? setD(await r.json()) : setError("Divisão não encontrada.")));
  }, [code]);
  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // acompanha os pagamentos das outras pessoas
    return () => clearInterval(t);
  }, [load]);

  if (error) return <p className="text-muted">{error}</p>;
  if (!d) return <p className="text-muted">A carregar…</p>;
  const link = typeof window !== "undefined" ? window.location.href : "";
  const payHref = (s: Share) => `/servicos/${d.service}?${new URLSearchParams({ ...d.fields, valor: String(s.amount / 100), parte: String(s.id) })}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="rounded-[2rem] bg-ink p-7 text-white">
        <Eyebrow dark icon={Users}>Conta dividida · {d.shares.length} pessoas</Eyebrow>
        <h1 className="mt-4 text-3xl font-bold">{d.title}</h1>
        <p className="text-white/60">{d.institution_name}</p>
        <p className="mt-5 font-display text-4xl font-bold">{formatMZN(d.paid)} <span className="text-lg text-white/60">de {formatMZN(d.total)}</span></p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-2 rounded-full bg-white" style={{ width: `${(d.paid / d.total) * 100}%` }} /></div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => { navigator.clipboard?.writeText(link); toast("Link copiado."); }} className="frame-none inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink"><Copy className="h-4 w-4" /> Copiar link</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Vamos dividir ${d.title}. Paga a tua parte aqui: ${link}`)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold"><Share2 className="h-4 w-4" /> Enviar por WhatsApp</a>
        </div>
      </section>
      <ul className="space-y-3">
        {d.shares.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 rounded-3xl border border-line bg-white p-5">
            <div className="flex items-center gap-3">
              {s.state === "pago" ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <Clock3 className="h-6 w-6 text-muted" />}
              <div>
                <p className="font-semibold">{s.name}</p>
                <p className="text-sm text-muted">{formatMZN(s.amount)} · {s.state === "pago" ? "Pago" : s.state === "a_pagar" ? "A pagar agora" : "Por pagar"}</p>
              </div>
            </div>
            {s.state === "por_pagar" ? (
              <Link href={payHref(s)} className="inline-flex min-h-10 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white">Pagar esta parte</Link>
            ) : s.reference ? <Link href={`/pagamento/${s.reference}`} className="text-sm font-semibold underline-offset-4 hover:underline">Ver</Link> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
