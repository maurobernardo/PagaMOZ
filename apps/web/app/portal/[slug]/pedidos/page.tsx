"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card } from "@/components/ui";
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

export default function Pedidos() {
  const { slug, canWrite } = usePortal();
  const [status, setStatus] = useState("SUBMETIDO");
  const [open, setOpen] = useState<string | null>(null);
  const { data, reload } = useLoad(
    () => api.GET("/api/portal/{institution_slug}/requests", {
      params: { path: { institution_slug: slug }, query: status ? { status } as never : {} },
    }),
    [slug, status],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-3">
        <select aria-label="Estado" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2" value={status}
          onChange={(e) => { setStatus(e.target.value); setOpen(null); }}>
          <option value="">Todos</option>
          {Object.entries(REQUEST_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {!data ? <p className="text-slate-600">A carregar…</p> : data.results.length === 0 ? (
          <Card><p className="text-sm text-slate-600">Sem pedidos neste estado.</p></Card>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {data.results.map((r) => (
              <li key={r.code}>
                <button onClick={() => setOpen(r.code)} aria-current={open === r.code}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50 ${open === r.code ? "bg-brand-50" : ""}`}>
                  <span>
                    <span className="block font-medium">{r.service_name}</span>
                    <span className="text-xs text-slate-600">{r.code} · {formatDateTime(r.created_at)}</span>
                  </span>
                  <Badge tone="info">{REQUEST_STATUS[r.status]}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {open ? <RequestDetail slug={slug} code={open} canAct={canWrite(["admin", "operador"])} onChange={reload} /> : (
        <Card className="hidden lg:block"><p className="text-sm text-slate-600">Seleccione um pedido para ver o formulário e os anexos.</p></Card>
      )}
    </div>
  );
}

function RequestDetail({ slug, code, canAct, onChange }: { slug: string; code: string; canAct: boolean; onChange: () => void }) {
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const { data: r, reload } = useLoad<Schemas["RequestPortal"]>(
    () => api.GET("/api/portal/{institution_slug}/requests/{code}", { params: { path: { institution_slug: slug, code } } }),
    [slug, code],
  );
  if (!r) return <Card><p className="text-slate-600">A carregar…</p></Card>;

  async function move(to: string) {
    const res = await api.POST("/api/portal/{institution_slug}/requests/{code}/status", {
      params: { path: { institution_slug: slug, code } },
      body: { status: to as never, note },
    });
    setMsg(res.data ? `Estado: ${REQUEST_STATUS[to]}` : errorMessage(res.error));
    if (res.data) { setNote(""); reload(); onChange(); }
  }

  return (
    <Card>
      <h2 className="text-lg font-bold">{r.service_name}</h2>
      <p className="font-mono text-sm">{r.code}</p>
      <dl className="mt-3 divide-y divide-slate-100 text-sm">
        {Object.entries(r.form as Record<string, string>).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 py-2"><dt className="text-slate-600">{k.replace(/_/g, " ")}</dt><dd className="font-medium">{v}</dd></div>
        ))}
      </dl>
      <h3 className="mt-4 text-sm font-semibold">Anexos</h3>
      <ul className="mt-1 space-y-1 text-sm">
        {r.attachments.map((a) => (
          <li key={a.id}>
            <a className="text-brand-800 underline" href={`/api/portal/${slug}/requests/${code}/attachments/${a.id}`}>
              {a.original_name}
            </a> <span className="text-slate-500">({Math.ceil(a.size / 1024)} KB)</span>
          </li>
        ))}
      </ul>
      {canAct && NEXT[r.status] ? (
        <div className="mt-4 space-y-2">
          <label htmlFor="note" className="block text-sm font-medium">Nota para o cidadão</label>
          <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="Obrigatória ao rejeitar ou pedir informação" />
          <div className="flex flex-wrap gap-2">
            {NEXT[r.status].map((to) => (
              <Button key={to} variant={to === "REJEITADO" ? "secondary" : "primary"} className="min-h-10 text-sm" onClick={() => move(to)}>
                {REQUEST_STATUS[to]}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      {msg ? <div className="mt-3"><Alert tone="info">{msg}</Alert></div> : null}
      <h3 className="mt-4 text-sm font-semibold">Histórico</h3>
      <ol className="mt-1 space-y-1 text-sm text-slate-700">
        {r.events.map((e, i) => <li key={i}>{formatDateTime(e.created_at)} — {REQUEST_STATUS[e.status]}{e.note ? `: ${e.note}` : ""}</li>)}
      </ol>
    </Card>
  );
}
