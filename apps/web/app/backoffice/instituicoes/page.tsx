"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, Field, useDialog } from "@/components/ui";
import { api, csrfToken, errorMessage, type Schemas } from "@/lib/api";
import { BrandMark } from "@/components/brand-mark";
import { DepositEditor } from "@/components/deposit-editor";
import { formatMZN } from "@/lib/i18n";
import { useLoad } from "@/lib/use-load";

type Inst = Schemas["InstitutionAdmin"];
const STATUS = { activa: ["Activa", "ok"], onboarding: ["Em adesão", "wait"], suspensa: ["Suspensa", "bad"] } as const;
const EMPTY = { name: "", slug: "", nuit: "", settlement_bank: "", settlement_account_masked: "", commission_bps: "150", admin_email: "", admin_name: "" };
type Invite = { who: string; inst: string; link?: string; emailed?: boolean };

export default function Instituicoes() {
  const toast = useToast();
  const dialog = useDialog();
  const [form, setForm] = useState(EMPTY);
  const [showNew, setShowNew] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [editing, setEditing] = useState<{ slug: string; name: string } | null>(null);

  /** Envia o logótipo (JPG/PNG/WebP até 3 MB); o servidor reduz e guarda em WebP. */
  async function uploadLogo(slug: string, file: File) {
    const fd = new FormData();
    fd.append("logo", file);
    const r = await fetch(`/api/backoffice/institutions/${slug}/logo`, { method: "POST", body: fd, headers: { "X-CSRFToken": csrfToken() }, credentials: "include" });
    if (!r.ok) return toast((await r.json().catch(() => ({}))).detail ?? "Não foi possível guardar o logótipo.", "bad");
    toast("Logótipo guardado.");
    reload();
  }
  const { data, reload } = useLoad(() => api.GET("/api/backoffice/institutions"), []);

  async function patch(slug: string, body: Partial<Inst>, what: string) {
    const r = await api.PATCH("/api/backoffice/institutions/{slug}", { params: { path: { slug } }, body: body as never });
    if (r.data) toast(`${r.data.name}: ${what}.`);
    else toast(errorMessage(r.error), "bad");
    reload();
  }

  /** Junta o administrador à instituição e mostra o link para ele definir a senha. */
  async function addAdmin(slug: string, instName: string, email: string, name: string) {
    const r = await api.POST("/api/backoffice/institutions/{slug}/members", { params: { path: { slug } }, body: { email, name, role: "admin" } as never });
    if (!r.data) return toast(errorMessage(r.error), "bad");
    const d = r.data as unknown as { invite_link?: string; emailed?: boolean };
    setInvite({ who: email, inst: instName, link: d.invite_link, emailed: d.emailed });
    reload();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(form.admin_email)) return toast("Escreva o email do administrador da instituição.", "bad");
    const { admin_email, admin_name, ...inst } = form;
    const r = await api.POST("/api/backoffice/institutions", {
      body: { ...inst, commission_bps: Number(form.commission_bps), commission_payer: "instituicao", status: "onboarding" } as never,
    });
    if (!r.data) return toast(errorMessage(r.error), "bad");
    toast(`${r.data.name} criada em adesão.`);
    if (logo) await uploadLogo(r.data.slug, logo);
    setLogo(null);
    await addAdmin(r.data.slug, r.data.name, admin_email, admin_name);
    setForm(EMPTY);
    setShowNew(false);
    reload();
  }

  const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-2">
        <p className="text-sm text-muted">{data?.length ?? 0} instituições</p>
        <Button className="min-h-10" onClick={() => setShowNew(!showNew)}>{showNew ? "Fechar" : "Nova instituição"}</Button>
      </div>
      {dialog.ui}

      {showNew ? (
        <Card>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2" noValidate>
            <Field id="n" label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) })} />
            <Field id="s" label="Identificador (URL)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            <Field id="nu" label="NUIT" inputMode="numeric" value={form.nuit} onChange={(e) => setForm({ ...form, nuit: e.target.value })} />
            <Field id="c" label="Comissão (pontos base, 150 = 1,5%)" inputMode="numeric" value={form.commission_bps}
              onChange={(e) => setForm({ ...form, commission_bps: e.target.value })} />
            <Field id="b" label="Banco de liquidação" value={form.settlement_bank} onChange={(e) => setForm({ ...form, settlement_bank: e.target.value })} />
            <Field id="a" label="Conta (só ficam os últimos 4 dígitos)" value={form.settlement_account_masked}
              onChange={(e) => setForm({ ...form, settlement_account_masked: e.target.value })} />
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">Logótipo (JPG, PNG ou WebP, até 3 MB)
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
                className="block w-full rounded-2xl border border-dashed border-line bg-white p-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:font-semibold file:text-white" />
            </label>
            <Field id="ae" label="Email do administrador da instituição" type="email" value={form.admin_email}
              onChange={(e) => setForm({ ...form, admin_email: e.target.value })} />
            <Field id="an" label="Nome do administrador" value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} />
            <Button type="submit" className="sm:col-span-2">Criar e convidar o administrador</Button>
          </form>
        </Card>
      ) : null}

      {editing ? <DepositEditor slug={editing.slug} name={editing.name} onClose={() => setEditing(null)} /> : null}

      {invite ? (
        <Card>
          <p className="font-display text-lg font-bold">{invite.who} é administrador de {invite.inst}</p>
          {invite.link ? (
            <>
              <p className="mt-1 text-sm text-muted">
                {invite.emailed ? "Enviámos o convite por email. " : ""}Envie-lhe este link para definir a senha (vale 3 dias, uma só vez):
              </p>
              <p className="mt-3 break-all rounded-xl bg-canvas p-3 font-mono text-xs">{invite.link}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button className="min-h-10" onClick={() => { navigator.clipboard.writeText(invite.link!); toast("Link copiado."); }}>Copiar link</Button>
                <a className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-sm font-semibold hover:border-ink" target="_blank" rel="noreferrer"
                  href={`https://wa.me/?text=${encodeURIComponent(`Defina a sua senha do portal PagaMOZ (${invite.inst}): ${invite.link}`)}`}>Enviar por WhatsApp</a>
                <button className="min-h-10 px-3 text-sm text-muted hover:text-ink" onClick={() => setInvite(null)}>Fechar</button>
              </div>
            </>
          ) : <p className="mt-1 text-sm text-muted">Esta pessoa já tinha senha: pode entrar no portal com o email.</p>}
        </Card>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <caption className="sr-only">Instituições</caption>
          <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Instituição</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2 text-right">Volume 30d</th>
              <th className="px-3 py-2 text-right">Comissão</th><th className="px-3 py-2">Liquidação</th><th className="px-3 py-2">Acções</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(data ?? []).map((i) => {
              const [label, tone] = STATUS[i.status as keyof typeof STATUS] ?? [i.status, "info"];
              return (
                <tr key={i.slug}>
                  <td className="px-3 py-2"><span className="flex items-center gap-3"><BrandMark slug={i.slug} name={i.name} size={36} /><span><span className="font-medium">{i.name}</span><br /><span className="text-xs text-muted">{i.services} serviços · {i.members} membros</span></span></span></td>
                  <td className="px-3 py-2"><Badge tone={tone}>{label}</Badge></td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMZN(i.volume_30d)} <span className="text-muted">({i.count_30d})</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <button className="rounded-full px-2 py-1 font-semibold hover:bg-canvas" onClick={async () => {
                      const v = await dialog.prompt({ title: `Comissão de ${i.name}`, body: "Em pontos base: 100 = 1%.", input: { label: "Pontos base", initial: String(i.commission_bps ?? "") }, confirm: "Guardar" });
                      if (v && /^\d+$/.test(v)) patch(i.slug, { commission_bps: Number(v) }, "comissão alterada");
                      else if (v) toast("Use só números inteiros (ex.: 150).", "bad");
                    }}>
                      {i.commission_bps != null ? `${(i.commission_bps / 100).toFixed(2).replace(".", ",")}%` : "-"}
                    </button>
                  </td>
                  <td className="px-3 py-2">{i.settlement_bank} {i.settlement_account_masked}</td>
                  <td className="px-3 py-2"><div className="flex flex-wrap gap-2">
                    <button className="min-h-9 rounded-full border border-line bg-white px-3.5 text-sm font-semibold transition hover:border-ink" onClick={async () => {
                      const email = await dialog.prompt({ title: `Administrador de ${i.name}`, body: "Recebe um link para definir a própria senha.", input: { label: "Email", initial: "" }, confirm: "Convidar" });
                      if (email) addAdmin(i.slug, i.name, email.trim(), "");
                    }}>Convidar admin</button>
                    <button className="min-h-9 rounded-full border border-line bg-white px-3.5 text-sm font-semibold transition hover:border-ink"
                      onClick={() => { setEditing({ slug: i.slug, name: i.name }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Contas e comissões</button>
                    <label className="inline-flex min-h-9 cursor-pointer items-center rounded-full border border-line bg-white px-3.5 text-sm font-semibold transition hover:border-ink">
                      Logótipo
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadLogo(i.slug, e.target.files[0])} />
                    </label>
                    {i.status !== "activa" ? (
                      <button className="min-h-9 rounded-full bg-ink px-3.5 text-sm font-semibold text-white hover:bg-ink/85" onClick={() => patch(i.slug, { status: "activa" }, "activada")}>Activar</button>
                    ) : (
                      <button className="min-h-9 rounded-full border border-accent/40 px-3.5 text-sm font-semibold text-accent hover:bg-accent-soft" onClick={async () => (await dialog.confirm({ title: `Suspender ${i.name}?`, body: "Sai do catálogo e o portal da instituição fica bloqueado.", confirm: "Suspender", danger: true })) && patch(i.slug, { status: "suspensa" }, "suspensa")}>Suspender</button>
                    )}
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
