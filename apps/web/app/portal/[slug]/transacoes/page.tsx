"use client";

import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Search, SlidersHorizontal, Undo2 } from "lucide-react";
import { useState } from "react";
import { MethodIcon } from "@/components/method-icon";
import { filterInput, Table, TableEmpty } from "@/components/table";
import { useToast } from "@/components/toast";
import { Badge, Button, Toolbar, useDialog } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, formatMZN, METHOD_LABEL, PAYMENT_STATUS } from "@/lib/i18n";
import { useLoad, usePortal } from "../portal-context";

export default function Transacoes() {
  const { slug, canWrite } = usePortal();
  const toast = useToast();
  const dialog = useDialog();
  const [f, setF] = useState({ q: "", status: "", method: "", date_from: "", date_to: "" });
  const [applied, setApplied] = useState(f);
  const [page, setPage] = useState(1);
  const query = Object.fromEntries(Object.entries(applied).filter(([, v]) => v));
  const { data, error, reload } = useLoad(
    () => api.GET("/api/portal/{institution_slug}/transactions", { params: { path: { institution_slug: slug }, query: { ...query, page } } }),
    [slug, JSON.stringify(applied), page],
  );
  const exportUrl = (fmt: string) => `/api/portal/${slug}/transactions?${new URLSearchParams({ ...query, export: fmt })}`;

  async function reverse(reference: string, total: number) {
    const reason = await dialog.prompt({
      title: `Devolver ${formatMZN(total)}?`,
      body: `O pagamento ${reference} é anulado e o cidadão é reembolsado. Fica registado na auditoria.`,
      input: { label: "Motivo", placeholder: "Ex.: pagamento em duplicado", multiline: true },
      confirm: "Devolver pagamento",
      danger: true,
    });
    if (!reason) return;
    const r = await api.POST("/api/portal/{institution_slug}/transactions/{reference}/reverse", {
      params: { path: { institution_slug: slug, reference } },
      body: { reason },
    });
    if (r.data) toast(`Pagamento ${reference} devolvido.`);
    else toast(errorMessage(r.error), "bad");
    reload();
  }

  return (
    <div className="space-y-6">
      {dialog.ui}
      <form className="flex flex-wrap items-center gap-3" onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(f); toast("Filtros aplicados.", "info"); }}>
        <Toolbar className="flex-1 !rounded-[1.75rem]">
          <label className="relative flex-1 basis-48">
            <span className="sr-only">Referência ou detalhe</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className={`${filterInput} w-full pl-10`} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Pesquisar referência…" />
          </label>
          <select aria-label="Estado" className={filterInput} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="">Todos os estados</option>
            {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select aria-label="Método" className={filterInput} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
            <option value="">Todos os métodos</option>
            {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input aria-label="De" type="date" className={filterInput} value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value })} />
          <input aria-label="Até" type="date" className={filterInput} value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value })} />
          <Button type="submit" className="!min-h-10"><SlidersHorizontal className="h-4 w-4" /> Filtrar</Button>
        </Toolbar>
        <Toolbar>
          <a href={exportUrl("csv")} onClick={() => toast("A preparar CSV…", "info")} className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold hover:bg-white">
            <FileText className="h-4 w-4" /> CSV
          </a>
          <a href={exportUrl("xlsx")} onClick={() => toast("A preparar Excel…", "info")} className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold hover:bg-white">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </a>
        </Toolbar>
      </form>

      {error ? <p role="alert" className="text-accent">Não foi possível carregar as transacções.</p> : null}

      <Table caption="Transacções" head={["Pagamento", "Data", "Total", "Líquido", "Estado", ""]}>
        {!data ? <TableEmpty cols={6}>A carregar…</TableEmpty> : data.results.length === 0 ? (
          <TableEmpty cols={6}>Nenhuma transacção com estes filtros.</TableEmpty>
        ) : data.results.map((t) => {
          const st = PAYMENT_STATUS[t.status];
          return (
            <tr key={t.reference}>
              <td>
                <div className="flex items-center gap-3">
                  <MethodIcon method={t.method} className="h-10 w-10" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{t.service_name}</p>
                    <p className="font-mono text-xs text-muted">{t.reference} · {t.method_label}</p>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap text-muted">{formatDateTime(t.confirmed_at ?? t.created_at)}</td>
              <td className="text-right tabular-nums">{formatMZN(t.total)}</td>
              <td className="text-right font-display font-bold tabular-nums">{formatMZN(t.institution_net)}</td>
              <td><Badge tone={st?.tone ?? "info"}>{st?.label ?? t.status}</Badge></td>
              <td className="text-right">
                {t.status === "CONFIRMADA" && canWrite(["admin", "financeiro"]) ? (
                  <button onClick={() => reverse(t.reference, t.total)} className="frame inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-semibold text-accent hover:bg-accent-soft">
                    <Undo2 className="h-4 w-4" /> Devolver
                  </button>
                ) : null}
              </td>
            </tr>
          );
        })}
      </Table>

      {data ? (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>{data.count} transacções</span>
          <Toolbar>
            <Button variant="ghost" className="!min-h-9" disabled={!data.previous} onClick={() => setPage(page - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-2 font-semibold text-ink">{page}</span>
            <Button variant="ghost" className="!min-h-9" disabled={!data.next} onClick={() => setPage(page + 1)} aria-label="Página seguinte"><ChevronRight className="h-4 w-4" /></Button>
          </Toolbar>
        </div>
      ) : null}
    </div>
  );
}
