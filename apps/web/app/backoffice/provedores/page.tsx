"use client";

import { Badge, Card } from "@/components/ui";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

export default function Provedores() {
  const { data } = useLoad(() => api.GET("/api/backoffice/providers"), []);
  const { data: params } = useLoad(() => api.GET("/api/backoffice/parameters"), []);
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((p) => {
          const rate = p.success_rate_24h;
          const tone = rate == null ? "info" : rate >= 0.9 ? "ok" : rate >= 0.75 ? "wait" : "bad";
          return (
            <Card key={p.method} className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{p.label}</p>
                <Badge tone={tone}>{rate == null ? "sem tráfego" : `${(rate * 100).toFixed(1)}% sucesso`}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">{p.total_24h} pagamentos (24h) · {p.pending} pendentes</p>
              <p className="mt-1 text-xs text-slate-500">Adaptador: {p.adapter}</p>
            </Card>
          );
        })}
      </div>
      <Card>
        <h2 className="font-bold">Parâmetros do ambiente</h2>
        <p className="text-sm text-slate-600">Só leitura. Alteram-se por variáveis de ambiente e novo deploy (ficam versionados).</p>
        <dl className="mt-3 divide-y divide-slate-100 text-sm">
          {Object.entries((params?.items ?? {}) as Record<string, unknown>).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 py-2"><dt className="font-mono">{k}</dt><dd>{String(v)}</dd></div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
