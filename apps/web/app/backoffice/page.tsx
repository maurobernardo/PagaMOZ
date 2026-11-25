"use client";

import Link from "next/link";
import { Alert, Card } from "@/components/ui";
import { api } from "@/lib/api";
import { formatMZN, PAYMENT_STATUS } from "@/lib/i18n";
import { useLoad } from "@/lib/use-load";

type Sum = { count: number; gross: number; net: number };

export default function Overview() {
  const { data: d } = useLoad(() => api.GET("/api/backoffice/overview"), []);
  if (!d) return <p role="status" className="text-muted">A carregar…</p>;
  const today = d.today as Sum;
  const month = d.month as Sum;
  const alerts: [number, string, string][] = [
    [d.open_discrepancies, "divergências de reconciliação abertas", "/backoffice/reconciliacao"],
    [d.dead_letters, "entregas falhadas por rever", "/backoffice/falhas"],
    [d.stuck_pending, "pagamentos pendentes fora do prazo", "/backoffice/transacoes"],
  ];

  return (
    <div className="space-y-6">
      {!d.ledger_balanced ? <Alert>O ledger não está balanceado. Investigar imediatamente.</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Volume hoje" value={formatMZN(today.gross)} sub={`${today.count} pagamentos`} />
        <Kpi label="Volume 30 dias" value={formatMZN(month.gross)} sub={`${month.count} pagamentos`} />
        <Kpi label="Comissão 30 dias" value={formatMZN(d.commission_30d)} sub="receita da plataforma" />
        <Kpi label="Taxa de sucesso 24h" value={d.success_rate_24h == null ? "-" : `${(d.success_rate_24h * 100).toFixed(1)}%`}
          sub={`Em trânsito nos provedores: ${formatMZN(d.in_transit)}`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {alerts.map(([n, label, href]) => (
          <Link key={label} href={href}
            className={`rounded-2xl p-4 ring-1 ring-inset ${n ? "bg-accent-soft text-accent ring-accent/20" : "bg-ink text-white ring-ink"}`}>
            <span className="text-2xl font-bold">{n}</span> <span className="text-sm">{label}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-bold">Maiores instituições (30 dias)</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {(d.top_institutions as { institution__name: string; institution__slug: string; count: number; gross: number }[]).map((i) => (
              <li key={i.institution__slug} className="flex justify-between gap-3 py-2">
                <span>{i.institution__name} <span className="text-muted">· {i.count}</span></span>
                <span className="font-semibold tabular-nums">{formatMZN(i.gross)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-bold">Pagamentos nas últimas 24h por estado</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {Object.entries(d.by_status_24h as Record<string, number>).map(([s, n]) => (
              <li key={s} className="flex justify-between py-2"><span>{PAYMENT_STATUS[s]?.label ?? s}</span><span className="font-semibold">{n}</span></li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">
            Instituições: {Object.entries(d.institutions as Record<string, number>).map(([k, v]) => `${v} ${k}`).join(" · ")}
          </p>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-sm text-muted">{sub}</p>
    </Card>
  );
}
