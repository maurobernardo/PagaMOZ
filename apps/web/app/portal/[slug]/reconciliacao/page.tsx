"use client";

import { CalendarDays, CheckCircle2, CircleAlert, ListChecks } from "lucide-react";
import { useState } from "react";
import { filterInput } from "@/components/table";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, Empty, Skeleton, Toolbar, useDialog } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, formatMZN } from "@/lib/i18n";
import { useLoad, usePortal } from "../portal-context";

export default function Reconciliacao() {
  const { slug, canWrite, refreshAlerts } = usePortal();
  const toast = useToast();
  const dialog = useDialog();
  const [day, setDay] = useState<string>("");
  const { data, reload } = useLoad(
    () => api.GET("/api/portal/{institution_slug}/reconciliation", { params: { path: { institution_slug: slug }, query: day ? { date: day } : {} } }),
    [slug, day],
  );

  async function resolve(id: number, ref: string) {
    const note = await dialog.prompt({
      title: "Resolver divergência",
      body: `Explique como ficou resolvida a diferença em ${ref}. A nota fica na auditoria.`,
      input: { label: "Nota", placeholder: "Ex.: confirmado com o banco, valor correcto é o da plataforma", multiline: true },
      confirm: "Marcar resolvida",
    });
    if (!note) return;
    const r = await api.POST("/api/portal/{institution_slug}/reconciliation/{id}/resolve", { params: { path: { institution_slug: slug, id } }, body: { note } });
    if (r.data) toast("Divergência resolvida.");
    else toast(errorMessage(r.error), "bad");
    reload();
    refreshAlerts();
  }

  if (!data) return <div className="grid gap-6 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>;
  if (!data.date) return <Empty icon={<CalendarDays className="h-5 w-5" />} title="Ainda não correu nenhuma reconciliação.">Corre automaticamente todos os dias às 23:30.</Empty>;

  const open = data.items.filter((i) => !i.resolved).length;
  const runs = data.runs as { date: string; discrepancies: number }[];

  return (
    <div className="space-y-6">
      {dialog.ui}
      <div className="flex flex-wrap items-center gap-3">
        <Toolbar>
          <CalendarDays className="ml-3 h-4 w-4 text-muted" />
          <select aria-label="Dia" className={filterInput} value={day || data.date} onChange={(e) => setDay(e.target.value)}>
            {runs.map((r) => <option key={r.date} value={r.date}>{r.date}{r.discrepancies ? ` · ${r.discrepancies} divergências` : ""}</option>)}
          </select>
        </Toolbar>
        {data.ran_at ? <span className="text-sm text-muted">Executada {formatDateTime(data.ran_at)}</span> : null}
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Kpi icon={<ListChecks className="h-6 w-6" />} label="Transacções do dia" value={data.platform_count} />
        <Kpi icon={<CheckCircle2 className="h-6 w-6" />} label="Conferem com o provedor" value={data.matched} />
        <Kpi icon={<CircleAlert className="h-6 w-6" />} label="Divergências abertas" value={open} alert={open > 0} />
      </div>

      {data.items.length === 0 ? (
        <Empty icon={<CheckCircle2 className="h-5 w-5" />} title="Tudo confere.">O extracto do provedor e a plataforma coincidem neste dia.</Empty>
      ) : (
        <ul className="space-y-3">
          {data.items.map((i) => (
            <li key={i.id}>
              <Card className="flex flex-wrap items-center justify-between gap-4 !p-5">
                <div className="flex min-w-0 items-start gap-4">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${i.resolved ? "bg-canvas" : "bg-accent-soft text-accent"}`}>
                    {i.resolved ? <CheckCircle2 className="h-5 w-5" /> : <CircleAlert className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{i.kind_label}</p>
                      {i.resolved ? <Badge tone="ok">Resolvida</Badge> : null}
                    </div>
                    <p className="font-mono text-xs text-muted">{i.reference || i.provider_ref}</p>
                    <p className="mt-1 text-sm">{i.detail}</p>
                    <p className="text-sm text-muted">
                      Plataforma {i.platform_amount != null ? formatMZN(i.platform_amount) : "-"} · Provedor {i.provider_amount != null ? formatMZN(i.provider_amount) : "-"}
                    </p>
                    {i.resolution_note ? <p className="mt-1 text-sm italic text-muted">“{i.resolution_note}”</p> : null}
                  </div>
                </div>
                {!i.resolved && canWrite(["admin", "financeiro"]) ? (
                  <Button variant="secondary" onClick={() => resolve(i.id, i.reference || i.provider_ref)}>Marcar resolvida</Button>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, alert }: { icon: React.ReactNode; label: string; value: number; alert?: boolean }) {
  return (
    <Card className="flex items-center gap-4 !p-5">
      <span className={`grid h-12 w-12 place-items-center rounded-2xl ${alert ? "bg-accent text-white" : "bg-canvas"}`}>{icon}</span>
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className="font-display text-3xl font-bold tabular-nums">{value}</p>
      </div>
    </Card>
  );
}
