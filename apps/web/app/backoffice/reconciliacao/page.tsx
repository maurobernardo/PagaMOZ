"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, Empty } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatMZN } from "@/lib/i18n";
import { useLoad } from "@/lib/use-load";

export default function Reconciliacao() {
  const toast = useToast();
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const { data, reload } = useLoad(() => api.GET("/api/backoffice/discrepancies"), []);

  async function run() {
    const r = await api.POST("/api/backoffice/reconciliation/run", { body: { date: day } });
    if (r.data) toast(`Reconciliação de ${day}: ${r.data.discrepancies} divergências.`);
    else toast(errorMessage(r.error), "bad");
    reload();
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3">
        <label className="grid text-sm font-medium">Dia
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="min-h-11 rounded-lg border border-line px-2" />
        </label>
        <Button className="min-h-11" onClick={run}>Correr reconciliação agora</Button>
        <p className="text-sm text-muted">Corre automaticamente todos os dias às 23:30.</p>
      </Card>
      {!data ? <p className="text-muted">A carregar…</p> : data.results.length === 0 ? (
        <Empty title="Sem divergências abertas.">Provedores e plataforma conferem.</Empty>
      ) : (
        <ul className="space-y-2">
          {data.results.map((i) => (
            <li key={i.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="bad">{i.kind_label}</Badge>
                  <span className="text-sm text-muted">{i.business_date}</span>
                  <span className="font-mono text-xs">{i.reference || i.provider_ref}</span>
                  <span className="text-sm font-medium">{i.institution_name ?? "Instituição desconhecida"}</span>
                </div>
                <p className="mt-1 text-sm text-ink/80">{i.detail}</p>
                <p className="text-sm text-muted">
                  Plataforma: {i.platform_amount != null ? formatMZN(i.platform_amount) : "—"} · Provedor: {i.provider_amount != null ? formatMZN(i.provider_amount) : "—"}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
