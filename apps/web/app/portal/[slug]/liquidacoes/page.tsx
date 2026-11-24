"use client";

import { Banknote, Clock3 } from "lucide-react";
import { Table, TableEmpty } from "@/components/table";
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
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="flex items-center gap-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-canvas"><Clock3 className="h-6 w-6" /></span>
          <div>
            <p className="text-sm text-muted">A liquidar no próximo lote</p>
            <p className="font-display text-3xl font-bold tabular-nums">{bal ? formatMZN(bal.a_liquidar) : "…"}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-5 !bg-ink text-white">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10"><Banknote className="h-6 w-6" /></span>
          <div>
            <p className="text-sm text-white/60">Total creditado em {bal?.conta_destino ?? "…"}</p>
            <p className="font-display text-3xl font-bold tabular-nums">{bal ? formatMZN(bal.liquidado) : "…"}</p>
          </div>
        </Card>
      </div>

      <Table caption="Lotes de liquidação" minWidth={680} head={["Dia", "Pagamentos", "Bruto", "Comissão", "Creditado", "Destino"]}>
        {!data ? <TableEmpty cols={6}>A carregar…</TableEmpty> : data.results.length === 0 ? (
          <TableEmpty cols={6}>Ainda não há liquidações.</TableEmpty>
        ) : data.results.map((s) => (
          <tr key={s.id}>
            <td className="whitespace-nowrap font-semibold">{new Date(s.business_date).toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" })}</td>
            <td className="tabular-nums">{s.count}</td>
            <td className="tabular-nums">{formatMZN(s.gross)}</td>
            <td className="tabular-nums text-muted">− {formatMZN(s.commission)}</td>
            <td className="font-display font-bold tabular-nums">{formatMZN(s.net)}</td>
            <td className="text-muted">{s.destination}</td>
          </tr>
        ))}
      </Table>
      <p className="text-xs text-muted">Liquidação simulada no próprio dia (D+0). Em produção, o calendário segue o contrato com o parceiro licenciado.</p>
    </div>
  );
}
