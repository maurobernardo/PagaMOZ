"use client";

import { FileText, Inbox, Paperclip } from "lucide-react";
import { useState } from "react";
import { filterInput } from "@/components/table";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, Empty, Skeleton, Toolbar } from "@/components/ui";
import { api, errorMessage, type Schemas } from "@/lib/api";
import { formatDateTime, REQUEST_STATUS } from "@/lib/i18n";
import { useLoad, usePortal } from "../portal-context";

const NEXT: Record<string, string[]> = {
  SUBMETIDO: ["EM_ANALISE", "REJEITADO"],
  EM_ANALISE: ["PENDENTE_INFO", "APROVADO", "REJEITADO"],
  PENDENTE_INFO: ["EM_ANALISE", "REJEITADO"],
  APROVADO: ["PRONTO", "CONCLUIDO"],
  PRONTO: ["CONCLUIDO"],
};
const toneOf = (s: string) => (s === "REJEITADO" ? "bad" : s === "CONCLUIDO" ? "ok" : s === "SUBMETIDO" ? "wait" : "info");

export default function Pedidos() {
  const { slug, canWrite, refreshAlerts } = usePortal();
  const [status, setStatus] = useState("SUBMETIDO");
  const [open, setOpen] = useState<string | null>(null);
  const { data, reload } = useLoad(
    () => api.GET("/api/portal/{institution_slug}/requests", { params: { path: { institution_slug: slug }, query: status ? ({ status } as never) : {} } }),
    [slug, status],
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <div className="space-y-4">
        <Toolbar className="w-full !rounded-[1.75rem]">
          <select aria-label="Estado" className={`${filterInput} w-full`} value={status} onChange={(e) => { setStatus(e.target.value); setOpen(null); }}>
            <option value="">Todos os estados</option>
            {Object.entries(REQUEST_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Toolbar>
        {!data ? <Skeleton className="h-64" /> : data.results.length === 0 ? (
          <Empty icon={<Inbox className="h-5 w-5" />} title="Sem pedidos neste estado." />
        ) : (
          <ul className="space-y-2">
            {data.results.map((r) => (
              <li key={r.code}>
                <button onClick={() => setOpen(r.code)} aria-current={open === r.code}
                  className={`flex w-full items-center gap-4 rounded-3xl border p-4 text-left transition ${open === r.code ? "border-ink bg-white shadow-lg" : "border-line bg-white/70 hover:bg-white"}`}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-canvas"><FileText className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.service_name}</span>
                    <span className="font-mono text-xs text-muted">{r.code} · {formatDateTime(r.created_at)}</span>
                  </span>
                  <Badge tone={toneOf(r.status)}>{REQUEST_STATUS[r.status]}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {open ? (
        <RequestDetail slug={slug} code={open} canAct={canWrite(["admin", "operador"])} onChange={() => { reload(); refreshAlerts(); }} />
      ) : (
        <div className="hidden lg:block"><Empty icon={<FileText className="h-5 w-5" />} title="Seleccione um pedido">Veja o formulário, descarregue os anexos e actualize o estado.</Empty></div>
      )}
    </div>
  );
}

function RequestDetail({ slug, code, canAct, onChange }: { slug: string; code: string; canAct: boolean; onChange: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: r, reload } = useLoad<Schemas["RequestPortal"]>(
    () => api.GET("/api/portal/{institution_slug}/requests/{code}", { params: { path: { institution_slug: slug, code } } }),
    [slug, code],
  );
  if (!r) return <Skeleton className="h-96" />;

  async function move(to: string) {
    setBusy(true);
    const res = await api.POST("/api/portal/{institution_slug}/requests/{code}/status", {
      params: { path: { institution_slug: slug, code } },
      body: { status: to as never, note },
    });
    setBusy(false);
    if (res.data) {
      toast(`Pedido ${code}: ${REQUEST_STATUS[to]}.`);
      setNote("");
      reload();
      onChange();
    } else toast(errorMessage(res.error), "bad");
  }

  return (
    <Card className="animate-rise lg:sticky lg:top-6 lg:self-start">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{r.service_name}</h2>
          <p className="font-mono text-sm text-muted">{r.code}</p>
        </div>
        <Badge tone={toneOf(r.status)}>{REQUEST_STATUS[r.status]}</Badge>
      </div>
      <dl className="mt-6 divide-y divide-line rounded-2xl bg-canvas/60 px-4 text-sm">
        {Object.entries(r.form as Record<string, string>).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 py-3"><dt className="capitalize text-muted">{k.replace(/_/g, " ")}</dt><dd className="font-semibold">{v}</dd></div>
        ))}
      </dl>
      <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-muted">Anexos</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {r.attachments.map((a) => (
          <li key={a.id}>
            <a href={`/api/portal/${slug}/requests/${code}/attachments/${a.id}`} onClick={() => toast("A descarregar anexo…", "info")}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-line hover:ring-ink">
              <Paperclip className="h-4 w-4" /> {a.original_name} <span className="font-normal text-muted">{Math.ceil(a.size / 1024)} KB</span>
            </a>
          </li>
        ))}
      </ul>
      {canAct && NEXT[r.status] ? (
        <div className="mt-6 space-y-3">
          <label htmlFor="note" className="block text-sm font-semibold">Nota para o cidadão</label>
          <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className="w-full rounded-2xl border border-line p-3 text-sm focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/5" placeholder="Obrigatória ao rejeitar ou pedir informação" />
          <Toolbar>
            {NEXT[r.status].map((to) => (
              <Button key={to} disabled={busy} variant={to === "REJEITADO" ? "danger" : "primary"} className="!min-h-10 text-sm" onClick={() => move(to)}>
                {REQUEST_STATUS[to]}
              </Button>
            ))}
          </Toolbar>
        </div>
      ) : null}
      <h3 className="mt-8 text-sm font-bold uppercase tracking-wider text-muted">Histórico</h3>
      <ol className="mt-3 space-y-3 border-l-2 border-line pl-5">
        {r.events.map((e, i) => (
          <li key={i} className="relative text-sm">
            <span aria-hidden className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${i === r.events.length - 1 ? "bg-accent" : "bg-ink/30"}`} />
            <p className="font-semibold">{REQUEST_STATUS[e.status]}</p>
            {e.note ? <p className="text-muted">{e.note}</p> : null}
            <p className="text-xs text-muted">{formatDateTime(e.created_at)}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
