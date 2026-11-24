"use client";

import { ArrowLeftRight, Banknote, FileCheck2, LayoutDashboard, Scale, Store, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { AppShell, type Alert } from "@/components/app-shell";
import { Skeleton } from "@/components/ui";
import { api, type Schemas } from "@/lib/api";

type Ctx = { slug: string; name: string; role: string; canWrite: (roles: string[]) => boolean; refreshAlerts: () => void };
const PortalCtx = createContext<Ctx | null>(null);
export const usePortal = () => useContext(PortalCtx)!;

const ROLE = { admin: "Administrador", financeiro: "Financeiro", operador: "Operador" } as Record<string, string>;

export function PortalShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Schemas["Me"] | null>(null);
  const [m, setM] = useState<Schemas["Membership"] | null>(null);
  const [counts, setCounts] = useState({ requests: 0, discrepancies: 0 });
  const [tick, setTick] = useState(0);
  const p = { params: { path: { institution_slug: slug } } };

  useEffect(() => {
    // O painel também prova que a sessão tem MFA; sem isso volta ao login.
    Promise.all([api.GET("/api/me"), api.GET("/api/portal/{institution_slug}/dashboard", p)]).then(([meR, dash]) => {
      const mine = meR.data?.memberships.find((x) => x.institution.slug === slug);
      if (!mine || !dash.response.ok) return router.replace("/portal");
      setMe(meR.data!);
      setM(mine);
      setCounts({ requests: dash.data!.pending_requests, discrepancies: dash.data!.open_discrepancies });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, router, tick]);

  if (!m || !me)
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-label="A carregar portal">
        <Skeleton className="h-10 w-48" />
      </div>
    );

  const base = `/portal/${slug}`;
  const alerts: Alert[] = [
    ...(counts.requests ? [{ label: `${counts.requests} pedidos por tratar`, href: `${base}/pedidos` }] : []),
    ...(counts.discrepancies ? [{ label: `${counts.discrepancies} divergências na reconciliação`, href: `${base}/reconciliacao` }] : []),
  ];
  const first = (me.name || "").split(" ")[0] || "equipa";

  async function logout() {
    await api.POST("/api/auth/logout");
    router.replace("/portal");
  }

  return (
    <PortalCtx.Provider value={{ slug, name: m.institution.name, role: m.role, canWrite: (r) => r.includes(m.role), refreshAlerts: () => setTick((t) => t + 1) }}>
      <AppShell
        eyebrow={`Portal da instituição · ${ROLE[m.role] ?? m.role}`}
        org={m.institution.name}
        orgSub={ROLE[m.role] ?? m.role}
        userName={me.name || me.phone}
        greeting={<>Bem-vindo, {first}.</>}
        alerts={alerts}
        onLogout={logout}
        nav={[
          { href: base, label: "Painel", icon: LayoutDashboard, exact: true },
          { href: `${base}/transacoes`, label: "Transacções", icon: ArrowLeftRight },
          { href: `${base}/liquidacoes`, label: "Liquidações", icon: Banknote },
          { href: `${base}/reconciliacao`, label: "Reconciliação", icon: Scale, count: counts.discrepancies },
          { href: `${base}/pedidos`, label: "Pedidos", icon: FileCheck2, count: counts.requests },
          { href: `${base}/servicos`, label: "Serviços", icon: Store },
          { href: `${base}/equipa`, label: "Equipa", icon: Users },
        ]}
      >
        {children}
      </AppShell>
    </PortalCtx.Provider>
  );
}

export { useLoad } from "@/lib/use-load";
