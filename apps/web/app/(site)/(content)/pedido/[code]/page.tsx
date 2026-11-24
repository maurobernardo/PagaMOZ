"use client";

import { CheckCircle2, Clock3, FileText, Wallet, XCircle } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Alert, Badge, Skeleton } from "@/components/ui";
import { api, type ServiceRequest } from "@/lib/api";
import { formatDateTime, formatMZN, REQUEST_STATUS } from "@/lib/i18n";

const FINAL = ["CONCLUIDO", "REJEITADO", "CANCELADO"];
// Percurso normal de um pedido, para mostrar o que falta.
const PATH = ["AGUARDA_PAGAMENTO", "SUBMETIDO", "EM_ANALISE", "APROVADO", "PRONTO", "CONCLUIDO"];

export default function RequestPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [r, setR] = useState<ServiceRequest | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let stop = false;
    async function tick() {
      const res = await api.GET("/api/requests/{code}", { params: { path: { code } } }).catch(() => null);
      if (stop) return;
      if (res?.response.status === 404) return setMissing(true);
      if (res?.data) setR(res.data);
      if (!res?.data || !FINAL.includes(res.data.status)) setTimeout(tick, 15000);
    }
    tick();
    return () => {
      stop = true;
    };
  }, [code]);

  if (missing) return <div className="mx-auto max-w-xl"><Alert>Não encontrámos o pedido {code}.</Alert></div>;
  if (!r) return <div className="mx-auto max-w-xl space-y-4" role="status" aria-label="A carregar pedido"><Skeleton className="h-40" /><Skeleton className="h-72" /></div>;

  const tone = r.status === "REJEITADO" ? "bad" : r.status === "CONCLUIDO" ? "ok" : r.status === "AGUARDA_PAGAMENTO" ? "wait" : "info";
  const reached = PATH.indexOf(r.status);

  return (
    <div className="mx-auto max-w-xl">
      <section className="rounded-[2rem] bg-ink p-7 text-white">
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-ink"><FileText className="h-5 w-5" /></span>
          <Badge tone={tone}>{REQUEST_STATUS[r.status] ?? r.status}</Badge>
        </div>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-white/50">{r.institution_name}</p>
        <h1 className="mt-2 text-3xl font-bold">{r.service_name}</h1>
        <p className="mt-3 font-mono tracking-wider text-white/70">{r.code}</p>
        {reached >= 0 ? (
          <ol className="mt-8 flex gap-1.5" aria-label="Progresso do pedido">
            {PATH.map((s, i) => (
              <li key={s} title={REQUEST_STATUS[s]} className={`h-1.5 flex-1 rounded-full ${i <= reached ? "bg-white" : "bg-white/15"}`} />
            ))}
          </ol>
        ) : null}
      </section>

      {r.status === "AGUARDA_PAGAMENTO" ? (
        <section className="mt-4 rounded-[2rem] border border-line bg-white p-6">
          <p className="text-muted">Este pedido só segue para a instituição depois de pago.</p>
          <p className="mt-2 font-display text-3xl font-bold">{formatMZN(r.amount)}</p>
          <div className="glass mt-5 flex rounded-full p-1.5">
            <Link href={`/servicos/${r.service}?pedido=${r.code}`} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink font-semibold text-white hover:bg-ink/85">
              <Wallet className="h-4 w-4" /> Pagar agora
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mt-4 rounded-[2rem] border border-line bg-white p-6">
        <h2 className="text-xl font-bold">Histórico</h2>
        <ol className="mt-5 space-y-5 border-l-2 border-line pl-6">
          {r.events.map((e, i) => {
            const last = i === r.events.length - 1;
            const I = e.status === "REJEITADO" ? XCircle : last && !FINAL.includes(e.status) ? Clock3 : CheckCircle2;
            return (
              <li key={i} className="relative">
                <span aria-hidden className="absolute -left-[35px] top-0 grid h-6 w-6 place-items-center rounded-full bg-white">
                  <I className={`h-5 w-5 ${last ? "text-accent" : "text-ink/35"}`} />
                </span>
                <p className="font-semibold">{REQUEST_STATUS[e.status] ?? e.status}</p>
                {e.note ? <p className="mt-0.5 text-sm text-ink/80">{e.note}</p> : null}
                <p className="mt-0.5 text-xs text-muted">{formatDateTime(e.created_at)}</p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
