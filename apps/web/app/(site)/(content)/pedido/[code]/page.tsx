"use client";

import { use, useEffect, useState } from "react";
import { Alert, Badge, ButtonLink, Card } from "@/components/ui";
import { api, type ServiceRequest } from "@/lib/api";
import { formatDateTime, formatMZN, REQUEST_STATUS } from "@/lib/i18n";

const FINAL = ["CONCLUIDO", "REJEITADO", "CANCELADO"];

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
  if (!r) return <p role="status" className="mx-auto max-w-xl text-muted">A carregar pedido…</p>;

  const tone = r.status === "REJEITADO" ? "bad" : r.status === "CONCLUIDO" ? "ok" : r.status === "AGUARDA_PAGAMENTO" ? "wait" : "info";

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-sm font-medium uppercase tracking-wide text-muted">{r.institution_name}</p>
      <h1 className="mt-1 text-2xl font-bold">{r.service_name}</h1>
      <div className="mt-2 flex items-center gap-3">
        <span className="font-mono font-bold tracking-wider">{r.code}</span>
        <Badge tone={tone}>{REQUEST_STATUS[r.status] ?? r.status}</Badge>
      </div>

      {r.status === "AGUARDA_PAGAMENTO" ? (
        <Card className="mt-5">
          <p>Este pedido só segue para a instituição depois de pago ({formatMZN(r.amount)}).</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <ButtonLink href={`/servicos/${r.service}?pedido=${r.code}`}>Pagar agora</ButtonLink>
          </div>
        </Card>
      ) : null}

      <Card className="mt-5">
        <h2 className="font-bold">Histórico</h2>
        <ol className="mt-3 space-y-4 border-l-2 border-line pl-4">
          {r.events.map((e, i) => (
            <li key={i} className="relative">
              <span aria-hidden className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full ${i === r.events.length - 1 ? "bg-brand-600" : "bg-slate-300"}`} />
              <p className="font-semibold">{REQUEST_STATUS[e.status] ?? e.status}</p>
              {e.note ? <p className="text-sm text-ink/80">{e.note}</p> : null}
              <p className="text-xs text-muted">{formatDateTime(e.created_at)}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
