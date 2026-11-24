"use client";

import { useState } from "react";
import { Alert, Badge, Card } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, formatMZN } from "@/lib/i18n";
import { useLoad, usePortal } from "../portal-context";

export default function Reconciliacao() {
  const { slug, canWrite } = usePortal();
  const [day, setDay] = useState<string>("");
  const [msg, setMsg] = useState("");
  const { data, reload } = useLoad(
    () => api.GET("/api/portal/{institution_slug}/reconciliation", {
      params: { path: { institution_slug: slug }, query: day ? { date: day } : {} },
    }),
    [slug, day],
  );

  async function resolve(id: number) {
    const note = prompt("Como foi resolvida esta divergência?");
    if (!note) return;
    const r = await api.POST("/api/portal/{institution_slug}/reconciliation/{id}/resolve", {
      params: { path: { institution_slug: slug, id } },
      body: { note },
    });
    setMsg(r.data ? "Divergência marcada como resolvida." : errorMessage(r.error));
    reload();
  }

  if (!data) return <p role="status" className="text-slate-600">A carregar…</p>;
  if (!data.date) return <Card><p>Ainda não correu nenhuma reconciliação. Corre todos os dias às 23:30.</p></Card>;

  const open = data.items.filter((i) => !i.resolved).length;
  const runs = data.runs as { date: string; discrepancies: number }[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Dia&nbsp;
          <select className="min-h-11 rounded-lg border border-slate-300 bg-white px-2" value={day || data.date}
            onChange={(e) => setDay(e.target.value)}>
            {runs.map((r) => <option key={r.date} value={r.date}>{r.date}{r.discrepancies ? ` · ${r.discrepancies} divergências` : ""}</option>)}
          </select>
        </label>
        {data.ran_at ? <span className="text-sm text-slate-600">Executada {formatDateTime(data.ran_at)}</span> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-sm text-slate-600">Transacções do dia</p><p className="text-2xl font-bold">{data.platform_count}</p></Card>
        <Card className="p-4"><p className="text-sm text-slate-600">Conferem com o provedor</p><p className="text-2xl font-bold text-emerald-700">{data.matched}</p></Card>
        <Card className="p-4"><p className="text-sm text-slate-600">Divergências abertas</p><p className={`text-2xl font-bold ${open ? "text-red-700" : ""}`}>{open}</p></Card>
      </div>

      {msg ? <Alert tone="info">{msg}</Alert> : null}

      {data.items.length === 0 ? (
        <Alert tone="ok">Tudo confere: extracto do provedor e plataforma coincidem.</Alert>
      ) : (
        <ul className="space-y-2">
          {data.items.map((i) => (
            <li key={i.id}>
              <Card className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={i.resolved ? "ok" : "bad"}>{i.resolved ? "Resolvida" : i.kind_label}</Badge>
                    <span className="font-mono text-xs">{i.reference || i.provider_ref}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{i.detail}</p>
                  <p className="text-sm text-slate-600">
                    Plataforma: {i.platform_amount != null ? formatMZN(i.platform_amount) : "—"} · Provedor: {i.provider_amount != null ? formatMZN(i.provider_amount) : "—"}
                  </p>
                  {i.resolution_note ? <p className="mt-1 text-sm italic text-slate-600">{i.resolution_note}</p> : null}
                </div>
                {!i.resolved && canWrite(["admin", "financeiro"]) ? (
                  <button onClick={() => resolve(i.id)} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-brand-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
                    Marcar resolvida
                  </button>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
