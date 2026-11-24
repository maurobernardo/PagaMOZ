"use client";

import { ArrowLeftRight, Building2, LayoutDashboard, PlugZap, Scale, ScrollText, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell, type Alert } from "@/components/app-shell";
import { Skeleton } from "@/components/ui";
import { api, type Schemas } from "@/lib/api";

export default function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Schemas["Me"] | null>(null);
  const [o, setO] = useState<{ d: number; dl: number; stuck: number } | null>(null);

  useEffect(() => {
    Promise.all([api.GET("/api/me"), api.GET("/api/backoffice/overview")]).then(([m, ov]) => {
      if (!ov.response.ok || !m.data) return router.replace("/portal");
      setMe(m.data);
      setO({ d: ov.data!.open_discrepancies, dl: ov.data!.dead_letters, stuck: ov.data!.stuck_pending });
    });
  }, [router]);

  if (!me || !o)
    return <div className="grid min-h-dvh place-items-center" role="status" aria-label="A carregar backoffice"><Skeleton className="h-10 w-48" /></div>;

  const alerts: Alert[] = [
    ...(o.d ? [{ label: `${o.d} divergências de reconciliação`, href: "/backoffice/reconciliacao" }] : []),
    ...(o.dl ? [{ label: `${o.dl} entregas falhadas por rever`, href: "/backoffice/falhas" }] : []),
    ...(o.stuck ? [{ label: `${o.stuck} pagamentos pendentes fora do prazo`, href: "/backoffice/transacoes" }] : []),
  ];

  return (
    <AppShell
      eyebrow="Backoffice da plataforma · Equipa PagaMOZ"
      org="PagaMOZ"
      orgSub="Equipa da plataforma"
      userName={me.name || me.phone}
      greeting={<>Olá, {(me.name || "equipa").split(" ")[0]}.</>}
      alerts={alerts}
      onLogout={async () => { await api.POST("/api/auth/logout"); router.replace("/portal"); }}
      nav={[
        { href: "/backoffice", label: "Visão geral", icon: LayoutDashboard, exact: true },
        { href: "/backoffice/instituicoes", label: "Instituições", icon: Building2 },
        { href: "/backoffice/transacoes", label: "Transacções", icon: ArrowLeftRight },
        { href: "/backoffice/reconciliacao", label: "Reconciliação", icon: Scale, count: o.d },
        { href: "/backoffice/falhas", label: "Falhas", icon: TriangleAlert, count: o.dl },
        { href: "/backoffice/provedores", label: "Provedores", icon: PlugZap },
        { href: "/backoffice/auditoria", label: "Auditoria", icon: ScrollText },
      ]}
    >
      {children}
    </AppShell>
  );
}
