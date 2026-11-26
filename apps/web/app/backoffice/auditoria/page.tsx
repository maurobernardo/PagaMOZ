"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import { actionLabel, dataLabel } from "@/lib/audit-labels";
import { formatDateTime } from "@/lib/i18n";
import { useLoad } from "@/lib/use-load";

const GROUPS: Record<string, string> = { "payment.": "Pagamentos", "auth.": "Entradas", "institution.": "Instituições", "member.": "Equipas", "service.": "Serviços", "request.": "Pedidos", "reconciliation.": "Reconciliação", "deadletter.": "Eventos falhados", "transactions.": "Exportações" };
const inputCls = "min-h-11 rounded-lg border border-line bg-white px-2 text-sm";

export default function Auditoria() {
  const [f, setF] = useState({ action: "", actor: "" });
  const [applied, setApplied] = useState(f);
  const [page, setPage] = useState(1);
  const query = Object.fromEntries(Object.entries(applied).filter(([, v]) => v));
  const { data } = useLoad(() => api.GET("/api/backoffice/audit", { params: { query: { ...query, page } } }), [JSON.stringify(applied), page]);

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(f); }}>
        <label className="grid gap-1.5 text-xs font-semibold text-ink/80">Acção (prefixo)
          <select className={inputCls} value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })}>
            <option value="">Todas</option>
            {["payment.", "auth.", "institution.", "member.", "service.", "request.", "reconciliation.", "deadletter.", "transactions."].map((a) => (
              <option key={a} value={a}>{GROUPS[a] ?? a.slice(0, -1)}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-ink/80">Autor (nome, email ou telefone)
          <input className={inputCls} value={f.actor} onChange={(e) => setF({ ...f, actor: e.target.value })} />
        </label>
        <Button type="submit" className="min-h-11">Filtrar</Button>
      </form>
      <p className="text-sm text-muted">Registo imutável: não pode ser editado nem apagado, nem por administradores.</p>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <caption className="sr-only">Registo de auditoria</caption>
          <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-3 py-2">Quando</th><th className="px-3 py-2">Acção</th><th className="px-3 py-2">Autor</th>
              <th className="px-3 py-2">Instituição</th><th className="px-3 py-2">Objecto</th><th className="px-3 py-2">Dados</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(data?.results ?? []).map((e) => (
              <tr key={e.id} className="align-top">
                <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                <td className="px-3 py-2 font-medium" title={e.action}>{actionLabel(e.action)}</td>
                <td className="px-3 py-2">{e.actor_name ?? "Sistema"}</td>
                <td className="px-3 py-2">{e.institution_name ?? "-"}</td>
                <td className="px-3 py-2">{e.target_label || "-"}</td>
                <td className="max-w-xs px-3 py-2 text-xs text-muted">{dataLabel(e.data) || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data ? (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>{data.count} registos</span>
          <span className="flex gap-3">
            <Button variant="secondary" className="min-h-10" disabled={!data.previous} onClick={() => setPage(page - 1)}>Anterior</Button>
            <Button variant="secondary" className="min-h-10" disabled={!data.next} onClick={() => setPage(page + 1)}>Seguinte</Button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
