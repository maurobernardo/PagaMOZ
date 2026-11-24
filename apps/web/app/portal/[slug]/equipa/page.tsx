"use client";

import { ShieldAlert, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { filterInput } from "@/components/table";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, Field, Skeleton, useDialog } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { isValidPhone, normalizePhone } from "@/lib/i18n";
import { useLoad, usePortal } from "../portal-context";

const ROLES = { admin: "Administrador", financeiro: "Financeiro", operador: "Operador" } as const;
type Role = keyof typeof ROLES;

export default function Equipa() {
  const { slug, canWrite } = usePortal();
  const admin = canWrite(["admin"]);
  const toast = useToast();
  const dialog = useDialog();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("operador");
  const [err, setErr] = useState("");
  const p = { params: { path: { institution_slug: slug } } };
  const { data, reload } = useLoad(() => api.GET("/api/portal/{institution_slug}/members", p), [slug]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) return setErr("Número inválido. Ex.: 84 123 4567.");
    setErr("");
    const r = await api.POST("/api/portal/{institution_slug}/members", { ...p, body: { phone: normalizePhone(phone), name, role } });
    if (!r.data) return toast(errorMessage(r.error), "bad");
    toast(`${name || normalizePhone(phone)} adicionado como ${ROLES[role]}.`);
    setPhone("");
    setName("");
    reload();
  }

  async function change(id: number, who: string, newRole: Role) {
    const r = await api.PATCH("/api/portal/{institution_slug}/members/{id}", { params: { path: { institution_slug: slug, id } }, body: { role: newRole } });
    if (r.data) toast(`${who} agora é ${ROLES[newRole]}.`);
    else toast(errorMessage(r.error), "bad");
    reload();
  }

  async function remove(id: number, who: string) {
    if (!(await dialog.confirm({ title: `Remover ${who}?`, body: "Perde o acesso ao portal desta instituição de imediato.", confirm: "Remover", danger: true }))) return;
    const r = await api.DELETE("/api/portal/{institution_slug}/members/{id}", { params: { path: { institution_slug: slug, id } } });
    if (r.response.ok) toast(`${who} removido da equipa.`);
    else toast(errorMessage(r.error), "bad");
    reload();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      {dialog.ui}
      <Card className="!p-2">
        {!data ? <Skeleton className="m-4 h-40" /> : (
          <ul className="divide-y divide-line">
            {data.map((m) => {
              const who = m.name || m.phone;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-4 px-4 py-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink font-display text-sm font-bold text-white">
                    {who.split(" ").slice(0, 2).map((x) => x[0]).join("").toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{who}</span>
                    <span className="text-sm text-muted">{m.phone}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {m.mfa_enabled ? (
                      <Badge tone="ok"><ShieldCheck className="h-3 w-3" /> MFA</Badge>
                    ) : (
                      <Badge tone="bad"><ShieldAlert className="h-3 w-3" /> Sem MFA</Badge>
                    )}
                    {admin ? (
                      <>
                        <select aria-label={`Perfil de ${who}`} value={m.role} onChange={(e) => change(m.id, who, e.target.value as Role)} className={filterInput}>
                          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <button aria-label={`Remover ${who}`} onClick={() => remove(m.id, who)} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-accent-soft hover:text-accent">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : <span className="text-sm font-medium">{ROLES[m.role as Role]}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {admin ? (
        <Card className="lg:self-start">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-canvas"><UserPlus className="h-5 w-5" /></span>
          <h2 className="mt-4 text-xl font-bold">Adicionar membro</h2>
          <form onSubmit={invite} className="mt-5 space-y-4" noValidate>
            <Field id="m-phone" label="Telefone" type="tel" value={phone} error={err} onChange={(e) => setPhone(e.target.value)} placeholder="84 123 4567" />
            <Field id="m-name" label="Nome (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
            <fieldset>
              <legend className="text-sm font-semibold">Perfil</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {Object.entries(ROLES).map(([k, v]) => (
                  <label key={k} className={`cursor-pointer rounded-2xl px-2 py-3 text-center text-sm font-semibold ring-1 ring-inset transition ${role === k ? "bg-ink text-white ring-ink" : "ring-line hover:ring-ink/40"}`}>
                    <input type="radio" name="role" value={k} checked={role === k} onChange={() => setRole(k as Role)} className="sr-only" />
                    {v}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" className="w-full">Adicionar à equipa</Button>
          </form>
          <p className="mt-4 text-xs leading-relaxed text-muted">Operador trata pedidos. Financeiro vê transacções, devolve pagamentos e reconcilia. Administrador faz tudo, incluindo catálogo e equipa.</p>
        </Card>
      ) : null}
    </div>
  );
}
