"use client";

import { Lock, Pencil, Power, Store } from "lucide-react";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, Empty, Skeleton, Toolbar, useDialog } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatMZN, LEVEL_LABEL } from "@/lib/i18n";
import { useLoad, usePortal } from "../portal-context";

export default function Servicos() {
  const { slug, canWrite } = usePortal();
  const admin = canWrite(["admin"]);
  const toast = useToast();
  const dialog = useDialog();
  const { data, reload } = useLoad(() => api.GET("/api/portal/{institution_slug}/services", { params: { path: { institution_slug: slug } } }), [slug]);

  async function patch(id: number, body: Record<string, unknown>, ok: string) {
    const r = await api.PATCH("/api/portal/{institution_slug}/services/{id}", {
      params: { path: { institution_slug: slug, id: String(id) as never } },
      body: body as never,
    });
    if (r.data) toast(ok);
    else toast(errorMessage(r.error), "bad");
    reload();
  }

  async function editPrice(id: number, name: string, amount: number) {
    const v = await dialog.prompt({
      title: `Tarifa de ${name}`,
      body: "O novo valor aplica-se aos pagamentos a partir de agora.",
      input: { label: "Valor em MT", initial: String(amount / 100).replace(".", ",") },
      confirm: "Guardar tarifa",
    });
    const c = v ? Math.round(Number(v.replace(/\s/g, "").replace(",", ".")) * 100) : NaN;
    if (v && !(c > 0)) return toast("Indique um valor válido em MT.", "bad");
    if (c > 0) patch(id, { amount: c }, `Tarifa actualizada para ${formatMZN(c)}.`);
  }

  async function toggle(id: number, name: string, active: boolean) {
    if (active && !(await dialog.confirm({ title: `Desactivar ${name}?`, body: "Deixa de aparecer no catálogo para os cidadãos.", confirm: "Desactivar", danger: true }))) return;
    patch(id, { is_active: !active }, active ? `${name} desactivado.` : `${name} activo no catálogo.`);
  }

  if (!data) return <div className="grid gap-6 md:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>;

  return (
    <div className="space-y-6">
      {dialog.ui}
      {!admin ? (
        <p className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"><Lock className="h-4 w-4" /> Só administradores podem alterar o catálogo.</p>
      ) : null}
      {data.results.length === 0 ? <Empty icon={<Store className="h-5 w-5" />} title="Sem serviços no catálogo." /> : (
        <ul className="grid gap-6 md:grid-cols-2">
          {data.results.map((s) => (
            <li key={s.id}>
              <Card className={`flex h-full flex-col gap-3 ${s.is_active ? "" : "opacity-70"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">{LEVEL_LABEL[s.integration_level]}</p>
                    <h2 className="mt-1 text-xl font-bold">{s.name}</h2>
                  </div>
                  <Badge tone={s.is_active ? "ok" : "bad"}>{s.is_active ? "Activo" : "Inactivo"}</Badge>
                </div>
                <p className="font-display text-2xl font-bold">
                  {s.pricing === "fixo" ? formatMZN(s.amount) : s.pricing === "consulta" ? "Valor consultado" : "Valor livre"}
                </p>
                <p className="text-sm text-muted">
                  {s.pricing === "consulta" ? "Obtido do sistema da instituição em cada pagamento." : s.pricing === "aberto" ? "O cidadão indica quanto paga." : "Tarifa fixa."}
                  {s.commission_bps != null ? ` Comissão ${(s.commission_bps / 100).toFixed(2).replace(".", ",")}%.` : ""}
                </p>
                {admin ? (
                  <div className="mt-auto pt-3">
                    <Toolbar>
                      {s.pricing === "fixo" ? (
                        <Button variant="ghost" className="!min-h-10 text-sm" onClick={() => editPrice(s.id, s.name, s.amount ?? 0)}><Pencil className="h-4 w-4" /> Alterar tarifa</Button>
                      ) : null}
                      <Button variant="ghost" className={`!min-h-10 text-sm ${s.is_active ? "text-accent" : ""}`} onClick={() => toggle(s.id, s.name, !!s.is_active)}>
                        <Power className="h-4 w-4" /> {s.is_active ? "Desactivar" : "Activar"}
                      </Button>
                    </Toolbar>
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
