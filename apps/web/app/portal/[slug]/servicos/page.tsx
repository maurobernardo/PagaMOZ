"use client";

import { useState } from "react";
import { Alert, Badge, Card } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatMZN, LEVEL_LABEL } from "@/lib/i18n";
import { useLoad, usePortal } from "../portal-context";

export default function Servicos() {
  const { slug, canWrite } = usePortal();
  const admin = canWrite(["admin"]);
  const [msg, setMsg] = useState("");
  const { data, reload } = useLoad(
    () => api.GET("/api/portal/{institution_slug}/services", { params: { path: { institution_slug: slug } } }),
    [slug],
  );

  async function patch(id: number, body: Record<string, unknown>) {
    const r = await api.PATCH("/api/portal/{institution_slug}/services/{id}", {
      params: { path: { institution_slug: slug, id: String(id) as never } },
      body: body as never,
    });
    setMsg(r.data ? "Serviço actualizado." : errorMessage(r.error));
    reload();
  }

  return (
    <div className="space-y-3">
      {!admin ? <Alert tone="info">Só administradores podem alterar o catálogo.</Alert> : null}
      {msg ? <Alert tone="info">{msg}</Alert> : null}
      {!data ? <p className="text-slate-600">A carregar…</p> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.results.map((s) => (
            <li key={s.id}>
              <Card className="flex h-full flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{s.name}</p>
                  <Badge tone={s.is_active ? "ok" : "bad"}>{s.is_active ? "Activo" : "Inactivo"}</Badge>
                </div>
                <p className="text-sm text-slate-600">{LEVEL_LABEL[s.integration_level]} · {s.category}</p>
                <p className="text-sm">
                  {s.pricing === "fixo" ? `Tarifa: ${formatMZN(s.amount)}` : s.pricing === "consulta" ? "Valor consultado ao sistema da instituição" : "Valor definido pelo cidadão"}
                  {s.commission_bps != null ? ` · comissão ${(s.commission_bps / 100).toFixed(2).replace(".", ",")}%` : ""}
                </p>
                {admin ? (
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    {s.pricing === "fixo" ? (
                      <button className="min-h-10 rounded-lg px-3 text-sm font-semibold text-brand-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
                        onClick={() => {
                          const v = prompt("Nova tarifa em MT:", String((s.amount ?? 0) / 100));
                          const c = v ? Math.round(Number(v.replace(",", ".")) * 100) : NaN;
                          if (c > 0) patch(s.id, { amount: c });
                        }}>
                        Alterar tarifa
                      </button>
                    ) : null}
                    <button className="min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
                      onClick={() => patch(s.id, { is_active: !s.is_active })}>
                      {s.is_active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
