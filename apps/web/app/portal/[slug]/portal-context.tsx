"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { api, type Schemas } from "@/lib/api";

type Ctx = { slug: string; name: string; role: string; canWrite: (roles: string[]) => boolean };
const PortalCtx = createContext<Ctx | null>(null);
export const usePortal = () => useContext(PortalCtx)!;

const NAV = [
  ["", "Painel"],
  ["/transacoes", "Transacções"],
  ["/liquidacoes", "Liquidações"],
  ["/reconciliacao", "Reconciliação"],
  ["/pedidos", "Pedidos"],
  ["/servicos", "Serviços"],
  ["/equipa", "Equipa"],
] as const;

export function PortalShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [m, setM] = useState<Schemas["Membership"] | null>(null);

  useEffect(() => {
    // O dashboard também prova que a sessão tem MFA; sem isso volta ao login.
    Promise.all([api.GET("/api/me"), api.GET("/api/portal/{institution_slug}/balances", { params: { path: { institution_slug: slug } } })]).then(
      ([me, probe]) => {
        const mine = me.data?.memberships.find((x) => x.institution.slug === slug);
        if (!mine || !probe.response.ok) return router.replace("/portal");
        setM(mine);
      },
    );
  }, [slug, router]);

  async function logout() {
    await api.POST("/api/auth/logout");
    router.replace("/portal");
  }

  if (!m) return <p role="status" className="text-slate-600">A carregar portal…</p>;
  const base = `/portal/${slug}`;
  return (
    <PortalCtx.Provider value={{ slug, name: m.institution.name, role: m.role, canWrite: (r) => r.includes(m.role) }}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Portal da instituição · {m.role}</p>
          <h1 className="text-2xl font-bold tracking-tight">{m.institution.name}</h1>
        </div>
        <button onClick={logout} className="min-h-10 rounded-lg px-3 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-white">
          Sair
        </button>
      </div>
      <nav aria-label="Portal" className="-mx-4 mb-6 overflow-x-auto border-b border-slate-200 px-4">
        <ul className="flex gap-1 whitespace-nowrap">
          {NAV.map(([href, label]) => {
            const active = href ? path.startsWith(base + href) : path === base;
            return (
              <li key={href}>
                <Link href={base + href} aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium ${active ? "border-brand-700 text-brand-800" : "border-transparent text-slate-600 hover:text-slate-900"}`}>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {children}
    </PortalCtx.Provider>
  );
}

/** Pequeno helper de leitura com estado de carregamento/erro. */
export function useLoad<T>(fn: () => Promise<{ data?: T; error?: unknown }>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    fn().then((r) => live && (r.data ? setData(r.data) : setError(true)), () => live && setError(true));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, reload: () => setTick((t) => t + 1) };
}
