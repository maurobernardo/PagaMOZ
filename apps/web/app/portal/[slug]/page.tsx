"use client";

import { ArrowUpRight, CalendarDays, Download, FileCheck2, MoreHorizontal, Scale } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { MethodIcon } from "@/components/method-icon";
import { Badge, Card, Empty, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDateTime, formatMZN, PAYMENT_STATUS } from "@/lib/i18n";
import { useLoad, usePortal } from "./portal-context";

type Sum = { count: number; gross: number; net: number };
type Day = { date: string; count: number; net: number };

export default function Dashboard() {
  const { slug, name } = usePortal();
  const p = { params: { path: { institution_slug: slug } } };
  const { data: d, error } = useLoad(() => api.GET("/api/portal/{institution_slug}/dashboard", p), [slug]);
  const { data: recent } = useLoad(() => api.GET("/api/portal/{institution_slug}/transactions", p), [slug]);

  if (error) return <Empty title="Não foi possível carregar o painel.">Verifique a ligação e recarregue a página.</Empty>;
  if (!d)
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Skeleton className="h-72" /><Skeleton className="h-72" /><Skeleton className="h-80" /><Skeleton className="h-80" />
      </div>
    );

  const b = d.balances as { a_liquidar: number; liquidado_30d: number; conta_destino: string };
  const month = d.month as Sum;
  const today = d.today as Sum;
  const daily = d.daily as Day[];
  const settledPct = month.net ? Math.min(100, (b.liquidado_30d / month.net) * 100) : 0;
  const [bank, acct] = [b.conta_destino.replace(/\s*\*+\d+$/, ""), b.conta_destino.match(/\*+\d+$/)?.[0] ?? ""];
  const base = `/portal/${slug}`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      {/* Conta de liquidação: onde o dinheiro cai */}
      <Card className="animate-rise">
        <CardHead title="Conta de liquidação" href={`${base}/liquidacoes`} />
        <div className="mt-6 grid grid-cols-1 items-center gap-6 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="relative">
            <div className="absolute inset-0 translate-x-3 -translate-y-3 rounded-3xl bg-ink/15" aria-hidden />
            <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white shadow-2xl">
              <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border border-white/10" aria-hidden />
              <div className="absolute -right-2 top-10 h-40 w-40 rounded-full border border-white/10" aria-hidden />
              <div className="flex items-center justify-between">
                <LogoMark inverted className="h-8 w-8" />
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">Liquidação directa</span>
              </div>
              <p className="mt-8 text-xs uppercase tracking-[0.16em] text-white/50">Creditado nos últimos 30 dias</p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">{formatMZN(b.liquidado_30d)}</p>
              <div className="mt-6 flex items-end justify-between text-sm">
                <span className="font-mono tracking-widest text-white/80">{acct || "—"}</span>
                <span className="font-semibold">{bank}</span>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-dashed border-ink/15 bg-canvas/60 p-5">
            <p className="text-sm font-semibold text-muted">A caminho da conta</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">{formatMZN(b.a_liquidar)}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">Confirmado e a aguardar o próximo lote de liquidação.</p>
          </div>
        </div>
        <p className="mt-5 text-xs text-muted">{name} recebe directamente do parceiro de pagamento. O PagaMOZ não retém fundos.</p>
      </Card>

      {/* Total de hoje + acções rápidas */}
      <Card className="flex animate-rise flex-col items-center text-center [animation-delay:60ms]">
        <p className="font-semibold">Recebido hoje</p>
        <p className="mt-4 font-display text-[2.6rem] font-bold leading-none tabular-nums">{formatMZN(today.net)}</p>
        <p className="mt-3 text-sm text-muted">{today.count} pagamentos · líquido</p>
        <div className="mt-auto w-full pt-8">
          <div className="grid grid-cols-3 gap-2 rounded-3xl bg-canvas p-2">
            <QuickAction href={`/api/portal/${slug}/transactions?export=csv`} icon={<Download className="h-5 w-5" />} label="Exportar" download />
            <QuickAction href={`${base}/reconciliacao`} icon={<Scale className="h-5 w-5" />} label="Reconciliar" />
            <QuickAction href={`${base}/pedidos`} icon={<FileCheck2 className="h-5 w-5" />} label="Pedidos" />
          </div>
        </div>
      </Card>

      {/* Recebimentos diários */}
      <Card className="animate-rise [animation-delay:120ms]">
        <CardHead title="Recebimentos diários" sub="Líquido · últimos 30 dias" />
        <DailyBars daily={daily} />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="7 dias" value={formatMZN((d.week as Sum).net)} />
          <Stat label="30 dias" value={formatMZN(month.net)} />
          <Stat label="Pagamentos (30 d)" value={String(month.count)} />
        </div>
      </Card>

      {/* Medidor */}
      <Card className="flex animate-rise flex-col items-center [animation-delay:180ms]">
        <CardHead title="Taxa de liquidação" sub="30 dias" />
        <Gauge value={settledPct} />
        <p className="-mt-2 text-sm font-semibold">{settledPct >= 90 ? "Em dia" : "A acompanhar"}</p>
        <p className="mt-5 rounded-full bg-canvas px-4 py-2 text-sm">
          Liquidado: <strong className="tabular-nums">{formatMZN(b.liquidado_30d)}</strong>
        </p>
      </Card>

      {/* Transacções recentes */}
      <Card className="animate-rise [animation-delay:240ms]">
        <CardHead title="Transacções recentes" href={`${base}/transacoes`} />
        {!recent ? <Skeleton className="mt-6 h-64" /> : recent.results.length === 0 ? (
          <div className="mt-6"><Empty title="Ainda sem pagamentos.">Os pagamentos aparecem aqui assim que forem confirmados.</Empty></div>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {recent.results.slice(0, 6).map((t) => {
              const st = PAYMENT_STATUS[t.status];
              const out = t.status === "REVERTIDA";
              return (
                <li key={t.reference} className="flex items-center gap-4 py-3.5">
                  <MethodIcon method={t.method} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{t.service_name}</p>
                    <p className="text-sm text-muted">{t.method_label} · {formatDateTime(t.confirmed_at ?? t.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-display font-bold tabular-nums ${out ? "text-accent" : ""}`}>{out ? "−" : "+"} {formatMZN(t.institution_net)}</p>
                    {st && st.tone !== "ok" ? <Badge tone={st.tone}>{st.label}</Badge> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Por método */}
      <Card className="animate-rise [animation-delay:300ms]">
        <CardHead title="Por método" sub="30 dias" />
        <Breakdown rows={(d.by_method as { method: string; label: string; count: number; net: number }[]).map((r) => [r.label, r.count, r.net, r.method])} />
      </Card>

      <Card className="animate-rise lg:col-span-2 [animation-delay:360ms]">
        <CardHead title="Por serviço" sub="30 dias" />
        <Breakdown rows={(d.by_service as { service__name: string; count: number; net: number }[]).map((r) => [r.service__name, r.count, r.net])} wide />
      </Card>
    </div>
  );
}

function CardHead({ title, sub, href }: { title: string; sub?: string; href?: string }) {
  return (
    <div className="flex w-full items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {sub ? <p className="text-sm text-muted">{sub}</p> : null}
      </div>
      {href ? (
        <Link href={href} aria-label={`Ver ${title.toLowerCase()}`} className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-canvas hover:text-ink">
          <ArrowUpRight className="h-5 w-5" />
        </Link>
      ) : (
        <MoreHorizontal className="h-5 w-5 text-muted/50" aria-hidden />
      )}
    </div>
  );
}

function QuickAction({ href, icon, label, download }: { href: string; icon: React.ReactNode; label: string; download?: boolean }) {
  const cls = "flex flex-col items-center gap-2 rounded-2xl bg-white px-2 py-3.5 text-xs font-semibold shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-lg";
  return download ? <a href={href} className={cls}>{icon}{label}</a> : <Link href={href} className={cls}>{icon}{label}</Link>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-canvas px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-0.5 font-display font-bold tabular-nums">{value}</p>
    </div>
  );
}

function DailyBars({ daily }: { daily: Day[] }) {
  const max = Math.max(1, ...daily.map((x) => x.net));
  const last = daily.length - 1;
  return (
    <figure className="mt-6">
      <div className="flex h-44 items-end gap-[3px]" role="img" aria-label={`Recebimentos diários; máximo ${formatMZN(max)}`}>
        {daily.map((x, i) => (
          <div key={x.date} className="group relative flex h-full flex-1 items-end">
            <div title={`${x.date}: ${formatMZN(x.net)} (${x.count})`}
              className={`w-full rounded-t-md transition ${i === last ? "bg-accent" : "bg-ink/80 group-hover:bg-ink"}`}
              style={{ height: `${Math.max((x.net / max) * 100, x.net ? 3 : 0.8)}%` }} />
          </div>
        ))}
      </div>
      <figcaption className="mt-2 flex justify-between text-xs text-muted">
        <span>{new Date(daily[0]?.date).toLocaleDateString("pt-PT", { day: "numeric", month: "short" })}</span>
        <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-accent" /> hoje</span>
      </figcaption>
    </figure>
  );
}

function Gauge({ value }: { value: number }) {
  const r = 80;
  const c = Math.PI * r;
  return (
    <div className="relative mt-4 w-full max-w-[240px]">
      <svg viewBox="0 0 200 112" className="w-full" role="img" aria-label={`${value.toFixed(1)} por cento liquidado`}>
        <path d="M20 100a80 80 0 0 1 160 0" fill="none" stroke="#f4f4f1" strokeWidth="22" strokeLinecap="round" />
        <path d="M20 100a80 80 0 0 1 160 0" fill="none" stroke="#0b0b0c" strokeWidth="22" strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`} className="transition-[stroke-dasharray] duration-700" />
      </svg>
      <p className="absolute inset-x-0 bottom-1 text-center font-display text-4xl font-bold tabular-nums">
        {value.toFixed(1).replace(".", ",")}<span className="text-lg">%</span>
      </p>
    </div>
  );
}

function Breakdown({ rows, wide }: { rows: (string | number)[][]; wide?: boolean }) {
  const total = rows.reduce((a, r) => a + (r[2] as number), 0) || 1;
  if (rows.length === 0) return <p className="mt-6 text-sm text-muted">Sem pagamentos no período.</p>;
  return (
    <ul className={`mt-5 grid gap-x-10 gap-y-4 ${wide ? "md:grid-cols-2" : ""}`}>
      {rows.map(([label, count, net, method]) => (
        <li key={String(label)} className="flex items-center gap-3">
          {method ? <MethodIcon method={String(method)} className="h-9 w-9 rounded-xl" /> : null}
          <div className="min-w-0 flex-1">
            <div className="flex justify-between gap-3 text-sm">
              <span className="truncate font-medium">{label} <span className="text-muted">· {count}</span></span>
              <span className="font-semibold tabular-nums">{formatMZN(net as number)}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-canvas">
              <div className="h-1.5 rounded-full bg-ink" style={{ width: `${((net as number) / total) * 100}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
