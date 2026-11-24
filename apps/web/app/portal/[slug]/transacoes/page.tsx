"use client";

import { useState } from "react";
import { Alert, Badge, Button } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, formatMZN, METHOD_LABEL, PAYMENT_STATUS } from "@/lib/i18n";
import { useLoad, usePortal } from "../portal-context";

const inputCls = "min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm";

export default function Transacoes() {
  const { slug, canWrite } = usePortal();
  const [f, setF] = useState({ q: "", status: "", method: "", date_from: "", date_to: "" });
  const [applied, setApplied] = useState(f);
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState("");
  const query = Object.fromEntries(Object.entries(applied).filter(([, v]) => v));
  const { data, error, reload } = useLoad(
    () => api.GET("/api/portal/{institution_slug}/transactions", {
      params: { path: { institution_slug: slug }, query: { ...query, page } },
    }),
    [slug, JSON.stringify(applied), page],
  );
  const exportUrl = (fmt: string) => `/api/portal/${slug}/transactions?${new URLSearchParams({ ...query, export: fmt })}`;

  async function reverse(reference: string) {
    const reason = prompt("Motivo da devolução (visível na auditoria):");
    if (!reason) return;
    const r = await api.POST("/api/portal/{institution_slug}/transactions/{reference}/reverse", {
      params: { path: { institution_slug: slug, reference } },
      body: { reason },
    });
    setMsg(r.data ? `Pagamento ${reference} devolvido.` : errorMessage(r.error));
    reload();
  }

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(f); }}>
        <label className="grid text-xs font-medium text-slate-700">Referência
          <input className={inputCls} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="PMZ…" />
        </label>
        <label className="grid text-xs font-medium text-slate-700">Estado
          <select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="">Todos</option>
            {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label className="grid text-xs font-medium text-slate-700">Método
          <select className={inputCls} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
            <option value="">Todos</option>
            {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="grid text-xs font-medium text-slate-700">De
          <input type="date" className={inputCls} value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value })} />
        </label>
        <label className="grid text-xs font-medium text-slate-700">Até
          <input type="date" className={inputCls} value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value })} />
        </label>
        <Button type="submit" className="min-h-11">Filtrar</Button>
        <span className="ml-auto flex gap-2">
          <a href={exportUrl("csv")} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-brand-800 ring-1 ring-inset ring-slate-300 hover:bg-white">CSV</a>
          <a href={exportUrl("xlsx")} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-brand-800 ring-1 ring-inset ring-slate-300 hover:bg-white">Excel</a>
        </span>
      </form>

      {msg ? <Alert tone="info">{msg}</Alert> : null}
      {error ? <Alert>Não foi possível carregar as transacções.</Alert> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">Transacções</caption>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Referência</th><th className="px-3 py-2">Serviço</th><th className="px-3 py-2">Método</th>
              <th className="px-3 py-2">Data</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Líquido</th>
              <th className="px-3 py-2">Estado</th><th className="px-3 py-2"><span className="sr-only">Acções</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!data ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">A carregar…</td></tr>
            ) : data.results.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Nenhuma transacção com estes filtros.</td></tr>
            ) : data.results.map((t) => {
              const st = PAYMENT_STATUS[t.status];
              return (
                <tr key={t.reference}>
                  <td className="px-3 py-2 font-mono text-xs">{t.reference}</td>
                  <td className="px-3 py-2">{t.service_name}</td>
                  <td className="px-3 py-2">{t.method_label}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(t.confirmed_at ?? t.created_at)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMZN(t.total)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMZN(t.institution_net)}</td>
                  <td className="px-3 py-2"><Badge tone={st?.tone ?? "info"}>{st?.label ?? t.status}</Badge></td>
                  <td className="px-3 py-2 text-right">
                    {t.status === "CONFIRMADA" && canWrite(["admin", "financeiro"]) ? (
                      <button onClick={() => reverse(t.reference)} className="text-sm font-medium text-red-700 hover:underline">Devolver</button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data ? (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>{data.count} transacções</span>
          <span className="flex gap-2">
            <Button variant="secondary" className="min-h-10" disabled={!data.previous} onClick={() => setPage(page - 1)}>Anterior</Button>
            <Button variant="secondary" className="min-h-10" disabled={!data.next} onClick={() => setPage(page + 1)}>Seguinte</Button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
