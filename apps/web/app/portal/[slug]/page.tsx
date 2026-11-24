"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
import { api } from "@/lib/api";
import { formatMZN } from "@/lib/i18n";
import { useLoad, usePortal } from "./portal-context";

type Sum = { count: number; gross: number; net: number };

export default function Dashboard() {
  const { slug } = usePortal();
  const { data: d, error } = useLoad(
    () => api.GET("/api/portal/{institution_slug}/dashboard", { params: { path: { institution_slug: slug } } }),
    [slug],
  );
  if (error) return <p role="alert">Não foi possível carregar o painel.</p>;
  if (!d) return <p role="status" className="text-slate-600">A carregar…</p>;

  const b = d.balances as { a_liquidar: number; liquidado_30d: number; conta_destino: string };
  const daily = d.daily as { date: string; count: number; net: number }[];
  const max = Math.max(1, ...daily.map((x) => x.net));

  return (
    <div className="space-y-6">
      <section aria-label="Dinheiro da instituição" className="rounded-2xl bg-brand-900 p-5 text-white">
        <p className="text-sm text-brand-100">Liquidado na conta {b.conta_destino} (30 dias)</p>
        <p className="mt-1 text-3xl font-extrabold tabular-nums sm:text-4xl">{formatMZN(b.liquidado_30d)}</p>
        <p className="mt-2 text-sm text-brand-100">
          A liquidar (confirmado, a caminho da conta): <strong className="text-white tabular-nums">{formatMZN(b.a_liquidar)}</strong>
        </p>
        <p className="mt-3 text-xs text-brand-100/80">O PagaMOZ não retém fundos: o parceiro de pagamento transfere directamente para a conta da instituição.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {([["Hoje", d.today], ["7 dias", d.week], ["30 dias", d.month]] as [string, Sum][]).map(([label, s]) => (
          <Card key={label} className="p-4">
            <p className="text-sm text-slate-600">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{formatMZN(s.net)}</p>
            <p className="text-sm text-slate-600">{s.count} pagamentos · líquido</p>
          </Card>
        ))}
      </section>

      <div className="flex flex-wrap gap-3">
        {d.pending_requests > 0 && (
          <Link href={`/portal/${slug}/pedidos`} className="rounded-xl bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 ring-1 ring-inset ring-sky-600/20">
            {d.pending_requests} pedidos por tratar →
          </Link>
        )}
        {d.open_discrepancies > 0 && (
          <Link href={`/portal/${slug}/reconciliacao`} className="rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 ring-1 ring-inset ring-red-600/20">
            {d.open_discrepancies} divergências de reconciliação →
          </Link>
        )}
      </div>

      <Card>
        <h2 className="font-bold">Recebimentos diários (líquido, 30 dias)</h2>
        <figure className="mt-4">
          <svg viewBox={`0 0 ${daily.length * 10} 100`} preserveAspectRatio="none" className="h-40 w-full" role="img"
            aria-label={`Barras diárias; máximo ${formatMZN(max)}`}>
            {daily.map((x, i) => {
              const h = (x.net / max) * 96;
              return (
                <rect key={x.date} x={i * 10 + 1} y={100 - h} width={8} height={Math.max(h, x.net ? 1 : 0)} rx={1}
                  className="fill-brand-600 hover:fill-brand-800">
                  <title>{`${x.date}: ${formatMZN(x.net)} (${x.count})`}</title>
                </rect>
              );
            })}
          </svg>
          <figcaption className="mt-1 flex justify-between text-xs text-slate-500">
            <span>{daily[0]?.date}</span>
            <span>hoje</span>
          </figcaption>
        </figure>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown title="Por serviço (30 dias)" rows={(d.by_service as { "service__name": string; count: number; net: number }[]).map((r) => [r["service__name"], r.count, r.net])} />
        <Breakdown title="Por método (30 dias)" rows={(d.by_method as { label: string; count: number; net: number }[]).map((r) => [r.label, r.count, r.net])} />
      </div>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string, number, number][] }) {
  const total = rows.reduce((a, r) => a + r[2], 0) || 1;
  return (
    <Card>
      <h2 className="font-bold">{title}</h2>
      {rows.length === 0 ? <p className="mt-3 text-sm text-slate-600">Sem pagamentos no período.</p> : (
        <ul className="mt-3 space-y-3">
          {rows.map(([label, count, net]) => (
            <li key={label}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate">{label} <span className="text-slate-500">· {count}</span></span>
                <span className="font-semibold tabular-nums">{formatMZN(net)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-brand-600" style={{ width: `${(net / total) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
