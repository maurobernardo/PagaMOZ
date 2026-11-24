"use client";

import { Card } from "@/components/ui";
import { api } from "@/lib/api";
import { formatMZN } from "@/lib/i18n";
import { useLoad, usePortal } from "../portal-context";

export default function Liquidacoes() {
  const { slug } = usePortal();
  const p = { params: { path: { institution_slug: slug } } };
  const { data } = useLoad(() => api.GET("/api/portal/{institution_slug}/settlements", p), [slug]);
  const { data: bal } = useLoad(() => api.GET("/api/portal/{institution_slug}/balances", p), [slug]);

  return (
    <div className="space-y-4">
      {bal ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <p className="text-sm text-slate-600">A liquidar (próximo lote)</p>
            <p className="text-2xl font-bold tabular-nums">{formatMZN(bal.a_liquidar)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-slate-600">Total já creditado na conta {bal.conta_destino}</p>
            <p className="text-2xl font-bold tabular-nums text-brand-800">{formatMZN(bal.liquidado)}</p>
          </Card>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Lotes de liquidação</caption>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Dia</th><th className="px-3 py-2 text-right">Pagamentos</th>
              <th className="px-3 py-2 text-right">Bruto</th><th className="px-3 py-2 text-right">Comissão</th>
              <th className="px-3 py-2 text-right">Creditado</th><th className="px-3 py-2">Destino</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!data ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">A carregar…</td></tr>
            ) : data.results.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Ainda não há liquidações.</td></tr>
            ) : data.results.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2 whitespace-nowrap">{s.business_date}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.count}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMZN(s.gross)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">{formatMZN(s.commission)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-brand-800">{formatMZN(s.net)}</td>
                <td className="px-3 py-2">{s.destination}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Liquidação simulada D+0 (parceiro fictício). Em produção, o calendário segue o contrato com o parceiro licenciado.</p>
    </div>
  );
}
