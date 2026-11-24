"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, Field } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { isValidPhone, normalizePhone } from "@/lib/i18n";
import { useLoad, usePortal } from "../portal-context";

const ROLES = { admin: "Administrador", financeiro: "Financeiro", operador: "Operador" } as const;
type Role = keyof typeof ROLES;

export default function Equipa() {
  const { slug, canWrite } = usePortal();
  const admin = canWrite(["admin"]);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("operador");
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const p = { params: { path: { institution_slug: slug } } };
  const { data, reload } = useLoad(() => api.GET("/api/portal/{institution_slug}/members", p), [slug]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) return setMsg({ tone: "bad", text: "Número inválido." });
    const r = await api.POST("/api/portal/{institution_slug}/members", { ...p, body: { phone: normalizePhone(phone), name, role } });
    setMsg(r.data ? { tone: "ok", text: "Membro adicionado." } : { tone: "bad", text: errorMessage(r.error) });
    if (r.data) { setPhone(""); setName(""); reload(); }
  }

  async function change(id: number, newRole: Role) {
    const r = await api.PATCH("/api/portal/{institution_slug}/members/{id}", { params: { path: { institution_slug: slug, id } }, body: { role: newRole } });
    setMsg(r.data ? { tone: "ok", text: "Perfil alterado." } : { tone: "bad", text: errorMessage(r.error) });
    reload();
  }

  async function remove(id: number) {
    if (!confirm("Remover esta pessoa da equipa?")) return;
    const r = await api.DELETE("/api/portal/{institution_slug}/members/{id}", { params: { path: { institution_slug: slug, id } } });
    setMsg(r.response.ok ? { tone: "ok", text: "Removido." } : { tone: "bad", text: errorMessage(r.error) });
    reload();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card className="p-0">
        <ul className="divide-y divide-slate-100">
          {(data ?? []).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span>
                <span className="block font-medium">{m.name || m.phone}</span>
                <span className="text-sm text-slate-600">{m.phone}</span>
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={m.mfa_enabled ? "ok" : "wait"}>{m.mfa_enabled ? "MFA activo" : "Sem MFA"}</Badge>
                {admin ? (
                  <>
                    <select aria-label={`Perfil de ${m.phone}`} value={m.role} onChange={(e) => change(m.id, e.target.value as Role)}
                      className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm">
                      {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button onClick={() => remove(m.id)} className="min-h-10 px-2 text-sm text-red-700 hover:underline">Remover</button>
                  </>
                ) : <span className="text-sm">{ROLES[m.role as Role]}</span>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {admin ? (
        <Card>
          <h2 className="font-bold">Adicionar membro</h2>
          <form onSubmit={invite} className="mt-3 space-y-3" noValidate>
            <Field id="m-phone" label="Telefone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Field id="m-name" label="Nome (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="block text-sm font-medium">Perfil
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2">
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <Button type="submit" className="w-full">Adicionar</Button>
          </form>
          <p className="mt-3 text-xs text-slate-500">Operador: pedidos. Financeiro: transacções, devoluções, reconciliação. Administrador: tudo, incluindo catálogo e equipa.</p>
        </Card>
      ) : null}
      {msg ? <div className="lg:col-span-2"><Alert tone={msg.tone}>{msg.text}</Alert></div> : null}
    </div>
  );
}
