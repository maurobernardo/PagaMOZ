"use client";

import { Bell, LifeBuoy, LogOut, Menu, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./logo";
import { Eyebrow } from "./ui";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; count?: number };
export type Alert = { label: string; href: string };

type Props = {
  nav: NavItem[];
  eyebrow: string;
  org: string;
  orgSub: string;
  userName: string;
  greeting: React.ReactNode;
  alerts?: Alert[];
  onLogout: () => void;
  children: React.ReactNode;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "PM";
}

function today() {
  return new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Maputo" }).format(new Date());
}

export function AppShell({ nav, eyebrow, org, orgSub, userName, greeting, alerts = [], onLogout, children }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // Saudação só no painel; nas outras páginas o título é a secção activa.
  const current = [...nav].reverse().find((n) => (n.exact ? path === n.href : path.startsWith(n.href)));
  const isHome = current?.exact;
  useEffect(() => setOpen(false), [path]);

  const sidebar = (
    <div className="flex h-full flex-col gap-8 p-5">
      <Link href={nav[0].href} aria-label="Início do portal" className="px-2 pt-1">
        <Logo />
      </Link>

      <div className="rounded-3xl bg-canvas p-4">
        <p className="truncate font-display font-bold">{org}</p>
        <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-muted">{orgSub}</p>
      </div>

      <nav aria-label="Menu principal" className="flex-1">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Menu principal</p>
        <ul className="space-y-1">
          {nav.map(({ href, label, icon: I, exact, count }) => {
            const active = exact ? path === href : path.startsWith(href);
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined}
                  className={`group flex min-h-11 items-center gap-3 rounded-2xl px-3 text-[15px] font-medium transition ${active ? "bg-ink text-white" : "text-ink/70 hover:bg-canvas hover:text-ink"}`}>
                  <I className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                  <span className="flex-1">{label}</span>
                  {count ? (
                    <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold ${active ? "bg-white text-ink" : "bg-accent text-white"}`}>
                      {count}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-1 border-t border-line pt-4">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Outros</p>
        <a href="mailto:suporte@pagamoz.example" className="flex min-h-11 items-center gap-3 rounded-2xl px-3 text-[15px] font-medium text-ink/70 hover:bg-canvas hover:text-ink">
          <LifeBuoy className="h-[18px] w-[18px]" strokeWidth={1.8} /> Centro de ajuda
        </a>
        <button onClick={onLogout} className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-left text-[15px] font-medium text-ink/70 hover:bg-accent-soft hover:text-accent">
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} /> Sair
        </button>
      </div>
      <p className="px-3 text-[11px] leading-relaxed text-muted">© PagaMOZ · protótipo com dados fictícios</p>
    </div>
  );

  return (
    <div className="lg:grid lg:min-h-[calc(100dvh-28px)] lg:grid-cols-[272px_1fr]">
      <aside className="sticky top-0 hidden h-[calc(100dvh-28px)] overflow-y-auto border-r border-line bg-white lg:block">{sidebar}</aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button aria-label="Fechar menu" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[86vw] max-w-[300px] animate-rise overflow-y-auto bg-white">{sidebar}</aside>
        </div>
      ) : null}

      <div className="min-w-0">
        <header className="flex items-center gap-3 px-5 pt-6 sm:px-10 sm:pt-8">
          <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="glass grid h-11 w-11 place-items-center rounded-full lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden sm:block"><Eyebrow>{eyebrow}</Eyebrow></div>
          <div className="ml-auto flex items-center gap-2">
            <Notifications alerts={alerts} />
            <span title={userName} className="grid h-11 w-11 place-items-center rounded-full bg-ink font-display text-sm font-bold text-white">
              {initials(userName)}
            </span>
          </div>
        </header>

        <main id="conteudo" className="px-5 pb-16 sm:px-10">
          <div className="pb-10 pt-10 sm:pb-12 sm:pt-14">
            <div className="mb-3 sm:hidden"><Eyebrow>{eyebrow}</Eyebrow></div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-[2.6rem] sm:leading-[1.1]">{isHome || !current ? greeting : current.label}</h1>
            <p className="mt-2 text-muted first-letter:uppercase">{isHome || !current ? `${today()} · Maputo` : org}</p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

function Notifications({ alerts }: { alerts: Alert[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Notificações (${alerts.length})`}
        className="glass relative grid h-11 w-11 place-items-center rounded-full transition hover:bg-white">
        <Bell className="h-5 w-5" strokeWidth={1.8} />
        {alerts.length ? <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent ring-2 ring-white" /> : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-72 animate-rise rounded-3xl border border-line bg-white p-2 shadow-2xl">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="font-display font-bold">Notificações</p>
            <button aria-label="Fechar" onClick={() => setOpen(false)}><X className="h-4 w-4 text-muted" /></button>
          </div>
          {alerts.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-muted">Está tudo em dia.</p>
          ) : (
            alerts.map((a) => (
              <Link key={a.href + a.label} href={a.href} onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm hover:bg-canvas">
                <span className="h-2 w-2 shrink-0 rounded-full bg-accent" /> {a.label}
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
