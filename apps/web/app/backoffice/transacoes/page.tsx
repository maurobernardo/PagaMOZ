"use client";

import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDateTime, formatMZN, PAYMENT_STATUS } from "@/lib/i18n";
import { useLoad } from "@/lib/use-load";

const inputCls = "min-h-11 rounded-lg border border-line bg-white px-2 text-sm";

export default function Transacoes() {
  const [f, setF] = useState({ q: "", status: "", institution: "" });
  const [applied, setApplied] = useState(f);
  const [page, setPage] = useState(1);
  const query = Object.fromEntries(Object.entries(applied).filter(([, v]) => v));
  const { data: insts } = useLoad(() => api.GET("/api/backoffice/institutions"), []);
  const { data } = useLoad(
    () => api.GET("/api/backoffice/transactions", { params: { query: { ...query, page } } }),
    [JSON.stringify(applied), page],
  );

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(f); }}>
        <label className="grid gap-1.5 text-xs font-semibold text-ink/80">Referência
          <input className={inputCls} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="PMZ…" />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-ink/80">Instituição
          <select className={inputCls} value={f.institution} onChange={(e) => setF({ ...f, institution: e.target.value })}>
            <option value="">Todas</option>
            {(insts ?? []).map((i) => <option key={i.slug} value={i.slug}>{i.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-ink/80">Estado
          <select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="">Todos</option>
            {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <Button type="submit" className="min-h-11">Filtrar</Button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <caption className="sr-only">Transacções de todas as instituições</caption>
          <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Referência</th><th className="px-3 py-2">Instituição</th><th className="px-3 py-2">Serviço</th>
              <th className="px-3 py-2">Método</th><th className="px-3 py-2">Data</th><th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Comissão</th><th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(data?.results ?? []).map((t) => {
              const st = PAYMENT_STATUS[t.status];
              return (
                <tr key={t.reference}>
                  <td className="px-3 py-2 font-mono text-xs">{t.reference}</td>
                  <td className="px-3 py-2">{t.institution_name}</td>
                  <td className="px-3 py-2">{t.service_name}</td>
                  <td className="px-3 py-2">{t.method_label}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(t.confirmed_at ?? t.created_at)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMZN(t.total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMZN(t.commission)}</td>
                  <td className="px-3 py-2"><Badge tone={st?.tone ?? "info"}>{st?.label ?? t.status}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data ? (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>{data.count} transacções</span>
          <span className="flex gap-3">
            <Button variant="secondary" className="min-h-10" disabled={!data.previous} onClick={() => setPage(page - 1)}>Anterior</Button>
            <Button variant="secondary" className="min-h-10" disabled={!data.next} onClick={() => setPage(page + 1)}>Seguinte</Button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
