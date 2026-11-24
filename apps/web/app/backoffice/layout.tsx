"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const NAV = [
  ["", "Visão geral"],
  ["/instituicoes", "Instituições"],
  ["/transacoes", "Transacções"],
  ["/reconciliacao", "Reconciliação"],
  ["/falhas", "Falhas"],
  ["/provedores", "Provedores"],
  ["/auditoria", "Auditoria"],
] as const;

export default function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    api.GET("/api/backoffice/parameters").then((r) => (r.response.ok ? setOk(true) : router.replace("/portal")));
  }, [router]);

  if (!ok) return <p role="status" className="text-slate-600">A carregar backoffice…</p>;
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Equipa da plataforma</p>
          <h1 className="text-2xl font-bold tracking-tight">Backoffice PagaMOZ</h1>
        </div>
        <button
          onClick={async () => { await api.POST("/api/auth/logout"); router.replace("/portal"); }}
          className="min-h-10 rounded-lg px-3 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-white">
          Sair
        </button>
      </div>
      <nav aria-label="Backoffice" className="-mx-4 mb-6 overflow-x-auto border-b border-slate-200 px-4">
        <ul className="flex gap-1 whitespace-nowrap">
          {NAV.map(([href, label]) => {
            const full = `/backoffice${href}`;
            const active = href ? path.startsWith(full) : path === "/backoffice";
            return (
              <li key={href}>
                <Link href={full} aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium ${active ? "border-brand-700 text-brand-800" : "border-transparent text-slate-600 hover:text-slate-900"}`}>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {children}
    </>
  );
}
