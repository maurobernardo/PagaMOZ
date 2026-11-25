"use client";

import { ArrowLeftRight, Banknote, CheckCircle2, CircleAlert, LayoutDashboard, Scale, Smartphone, CreditCard, Landmark } from "lucide-react";
import { useEffect, useState } from "react";
import { LogoMark } from "./logo";

const TABS = [
  { key: "painel", label: "Painel", icon: LayoutDashboard },
  { key: "transacoes", label: "Transacções", icon: ArrowLeftRight },
  { key: "reconciliacao", label: "Reconciliação", icon: Scale },
  { key: "liquidacoes", label: "Liquidações", icon: Banknote },
] as const;
type Tab = (typeof TABS)[number]["key"];

const FEED = [
  { s: "Recarga Credelec", m: "M-Pesa", v: "500,00", i: Smartphone },
  { s: "Fatura pós-paga", m: "Visa •••• 4242", v: "2 318,40", i: CreditCard },
  { s: "Recarga Credelec", m: "e-Mola", v: "1 000,00", i: Smartphone },
  { s: "Fatura pós-paga", m: "Referência bancária", v: "4 120,00", i: Landmark },
  { s: "Recarga Credelec", m: "mKesh", v: "250,00", i: Smartphone },
  { s: "Recarga Credelec", m: "M-Pesa", v: "750,00", i: Smartphone },
];
const BARS = [38, 52, 44, 70, 58, 64, 49, 80, 66, 72, 61, 90, 76, 84];

/** Pré-visualização interactiva do portal: separadores clicáveis, rotação automática até o visitante interagir. */
export function HeroPreview() {
  const [tab, setTab] = useState<Tab>("painel");
  const [auto, setAuto] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 2600);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!auto || tick === 0 || tick % 2) return;
    setTab((cur) => TABS[(TABS.findIndex((t) => t.key === cur) + 1) % TABS.length].key);
  }, [tick, auto]);

  const pick = (k: Tab) => {
    setAuto(false);
    setTab(k);
  };

  return (
    <div className="overflow-hidden rounded-t-[1.75rem] border border-b-0 border-white/15 bg-white/5 p-2 pb-0 shadow-[0_-20px_80px_-20px_rgba(224,38,47,0.35)] backdrop-blur">
      <div className="overflow-hidden rounded-t-[1.35rem] bg-canvas text-left text-ink">
        <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3">
          <LayoutDashboard className="h-4 w-4 text-muted" />
          <span className="mx-auto rounded-full bg-canvas px-4 py-1 text-xs text-muted">pagamoz · portal da instituição</span>
          <span className="hidden items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-[11px] font-semibold text-white sm:inline-flex">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-accent" /></span>
            Ao vivo
          </span>
        </div>

        <div className="grid grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[190px_minmax(0,1fr)]">
          <nav aria-label="Pré-visualização do portal" className="space-y-1 border-r border-line bg-white p-2 sm:p-3">
            <div className="hidden items-center gap-2 px-2 pb-3 sm:flex"><LogoMark className="h-6 w-6" /><span className="font-display text-sm font-bold">pagamoz</span></div>
            {TABS.map(({ key, label, icon: I }) => (
              <button key={key} onClick={() => pick(key)} aria-pressed={tab === key}
                className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition ${tab === key ? "bg-ink text-white" : "text-muted hover:bg-canvas hover:text-ink"}`}>
                <I className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>

          <div className="min-h-[300px] p-4 sm:min-h-[330px] sm:p-6">
            <div key={tab} className="animate-rise">
              {tab === "painel" && <Painel />}
              {tab === "transacoes" && <Transacoes tick={tick} />}
              {tab === "reconciliacao" && <Reconciliacao />}
              {tab === "liquidacoes" && <Liquidacoes />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Painel() {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(t);
  }, []);
  return (
    <>
      <p className="font-display text-xl font-bold sm:text-2xl">Bem-vindo, Ana.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl bg-ink p-4 text-white">
          <p className="text-[10px] uppercase tracking-widest text-white/50">Creditado · 30 dias</p>
          <p className="mt-2 font-display text-xl font-bold">1 284 960,00 MT</p>
          <p className="mt-3 font-mono text-[10px] tracking-widest text-white/60">****1001 · Conta de liquidação</p>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <p className="text-[11px] text-muted">Recebido hoje</p>
          <p className="mt-1 font-display text-lg font-bold">42 916,15 MT</p>
          <p className="text-[11px] text-muted">58 pagamentos</p>
        </div>
        <div className="hidden rounded-2xl bg-white p-4 sm:block">
          <p className="text-[11px] text-muted">Taxa de liquidação</p>
          <p className="mt-1 font-display text-lg font-bold">96,5%</p>
          <div className="mt-2 h-1.5 rounded-full bg-canvas"><div className="h-1.5 rounded-full bg-ink transition-[width] duration-1000" style={{ width: grown ? "96%" : "0%" }} /></div>
        </div>
      </div>
      <div className="mt-3 rounded-2xl bg-white p-4">
        <p className="text-[11px] font-semibold">Recebimentos diários</p>
        <div className="mt-3 flex h-24 items-end gap-1.5">
          {BARS.map((h, i) => (
            <div key={i} className={`flex-1 rounded-t transition-[height] duration-700 ease-out ${i === BARS.length - 1 ? "bg-accent" : "bg-ink/80"}`}
              style={{ height: grown ? `${h}%` : "4%", transitionDelay: `${i * 35}ms` }} />
          ))}
        </div>
      </div>
    </>
  );
}

function Transacoes({ tick }: { tick: number }) {
  const rows = Array.from({ length: 5 }, (_, k) => FEED[(tick + FEED.length - k) % FEED.length]);
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="font-display text-xl font-bold">Transacções</p>
        <span className="rounded-full bg-canvas px-3 py-1 text-[11px] font-semibold">Hoje</span>
      </div>
      <ul className="mt-4 divide-y divide-line rounded-2xl bg-white">
        {rows.map((r, k) => (
          <li key={`${tick}-${k}`} className={`flex items-center gap-3 px-4 py-2.5 ${k === 0 ? "animate-rise bg-canvas/60" : ""}`}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-canvas"><r.i className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">{r.s}</span>
              <span className="block truncate text-[11px] text-muted">{r.m}</span>
            </span>
            <span className="text-xs font-bold tabular-nums">+ {r.v} MT</span>
            {k === 0 ? <CheckCircle2 className="h-4 w-4 text-ink" /> : null}
          </li>
        ))}
      </ul>
    </>
  );
}

function Reconciliacao() {
  return (
    <>
      <p className="font-display text-xl font-bold">Reconciliação de ontem</p>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        {[["Transacções", "214"], ["Conferem", "213"], ["Divergência", "1"]].map(([l, v], i) => (
          <div key={l} className={`rounded-2xl p-3 ${i === 2 ? "bg-accent text-white" : "bg-white"}`}>
            <p className={`text-[11px] ${i === 2 ? "text-white/80" : "text-muted"}`}>{l}</p>
            <p className="font-display text-xl font-bold">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-start gap-3 rounded-2xl bg-white p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><CircleAlert className="h-4 w-4" /></span>
        <div className="min-w-0 text-xs">
          <p className="font-semibold">Valor diferente</p>
          <p className="text-muted">Plataforma 1 000,00 MT · Provedor 1 050,00 MT</p>
          <p className="mt-2 inline-flex rounded-full bg-ink px-3 py-1 font-semibold text-white">Marcar resolvida</p>
        </div>
      </div>
    </>
  );
}

function Liquidacoes() {
  return (
    <>
      <p className="font-display text-xl font-bold">Liquidações</p>
      <ul className="mt-4 space-y-2">
        {[["Ontem", "58 412,30"], ["Segunda", "61 007,95"], ["Domingo", "39 880,10"]].map(([d, v], i) => (
          <li key={d} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-xs">
            <span className="flex items-center gap-2"><Banknote className="h-4 w-4" /> <span className="font-semibold">{d}</span></span>
            <span className="text-muted">Conta de liquidação ****1001</span>
            <span className={`font-display text-sm font-bold ${i === 0 ? "" : "text-ink/70"}`}>{v} MT</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-muted">O parceiro transfere directamente para a conta da instituição.</p>
    </>
  );
}
