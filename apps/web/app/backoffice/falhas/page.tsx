"use client";

import { useToast } from "@/components/toast";
import { Button, Card, Empty } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/i18n";
import { useLoad } from "@/lib/use-load";

const KIND: Record<string, string> = {
  "connector:confirm": "Notificação à instituição",
  "connector:reverse": "Estorno na instituição",
};

export default function Falhas() {
  const toast = useToast();
  const { data, reload } = useLoad(() => api.GET("/api/backoffice/dead-letters"), []);

  async function act(id: number, action: "retry" | "resolve") {
    const r = await api.POST("/api/backoffice/dead-letters/{id}", { params: { path: { id } }, body: { action } });
    if (r.data) toast(action === "retry" ? "Reenviado para a fila." : "Marcado como resolvido.");
    else toast(errorMessage(r.error), "bad");
    reload();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Entregas que esgotaram as tentativas automáticas (webhooks de provedores e notificações às instituições). Reenviar é seguro: os
        processos são idempotentes.
      </p>
      {!data ? <p className="text-muted">A carregar…</p> : data.results.length === 0 ? (
        <Empty title="Nenhuma falha pendente.">Todas as entregas chegaram ao destino.</Empty>
      ) : (
        <ul className="space-y-2">
          {data.results.map((d) => (
            <li key={d.id}>
              <Card className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{KIND[d.kind] ?? (d.kind.startsWith("webhook:") ? `Webhook ${d.kind.slice(8)}` : d.kind)}</p>
                  <p className="text-sm text-muted">{formatDateTime(d.created_at)} · <span className="font-mono">{JSON.stringify(d.payload).slice(0, 80)}</span></p>
                  <p className="mt-1 break-all font-mono text-xs text-accent">{d.error.slice(0, 200)}</p>
                </div>
                <span className="flex gap-2">
                  <Button className="min-h-10 text-sm" onClick={() => act(d.id, "retry")}>Reenviar</Button>
                  <Button variant="secondary" className="min-h-10 text-sm" onClick={() => act(d.id, "resolve")}>Resolvido</Button>
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
