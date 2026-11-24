"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, Field } from "@/components/ui";
import { api, errorMessage, type Schemas } from "@/lib/api";
import { formatMZN } from "@/lib/i18n";
import { useLoad } from "@/lib/use-load";

type Inst = Schemas["InstitutionAdmin"];
const STATUS = { activa: ["Activa", "ok"], onboarding: ["Em adesão", "wait"], suspensa: ["Suspensa", "bad"] } as const;
const EMPTY = { name: "", slug: "", nuit: "", settlement_bank: "", settlement_account_masked: "", commission_bps: "150" };

export default function Instituicoes() {
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [showNew, setShowNew] = useState(false);
  const { data, reload } = useLoad(() => api.GET("/api/backoffice/institutions"), []);

  async function patch(slug: string, body: Partial<Inst>, what: string) {
    const r = await api.PATCH("/api/backoffice/institutions/{slug}", { params: { path: { slug } }, body: body as never });
    setMsg(r.data ? { tone: "ok", text: `${r.data.name}: ${what}.` } : { tone: "bad", text: errorMessage(r.error) });
    reload();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await api.POST("/api/backoffice/institutions", {
      body: { ...form, commission_bps: Number(form.commission_bps), commission_payer: "instituicao", status: "onboarding" } as never,
    });
    if (!r.data) return setMsg({ tone: "bad", text: errorMessage(r.error) });
    setMsg({ tone: "ok", text: `${r.data.name} criada em adesão.` });
    setForm(EMPTY);
    setShowNew(false);
    reload();
  }

  const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-2">
        <p className="text-sm text-slate-600">{data?.length ?? 0} instituições</p>
        <Button className="min-h-10" onClick={() => setShowNew(!showNew)}>{showNew ? "Fechar" : "Nova instituição"}</Button>
      </div>
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}

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
            <Button type="submit" className="sm:col-span-2">Criar em adesão</Button>
          </form>
        </Card>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <caption className="sr-only">Instituições</caption>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Instituição</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2 text-right">Volume 30d</th>
              <th className="px-3 py-2 text-right">Comissão</th><th className="px-3 py-2">Liquidação</th><th className="px-3 py-2">Acções</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(data ?? []).map((i) => {
              const [label, tone] = STATUS[i.status as keyof typeof STATUS] ?? [i.status, "info"];
              return (
                <tr key={i.slug}>
                  <td className="px-3 py-2"><span className="font-medium">{i.name}</span><br /><span className="text-xs text-slate-500">{i.services} serviços · {i.members} membros</span></td>
                  <td className="px-3 py-2"><Badge tone={tone}>{label}</Badge></td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMZN(i.volume_30d)} <span className="text-slate-500">({i.count_30d})</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <button className="hover:underline" onClick={() => {
                      const v = prompt("Comissão em pontos base (100 = 1%):", String(i.commission_bps ?? ""));
                      if (v && /^\d+$/.test(v)) patch(i.slug, { commission_bps: Number(v) }, "comissão alterada");
                    }}>
                      {i.commission_bps != null ? `${(i.commission_bps / 100).toFixed(2).replace(".", ",")}%` : "—"}
                    </button>
                  </td>
                  <td className="px-3 py-2">{i.settlement_bank} {i.settlement_account_masked}</td>
                  <td className="px-3 py-2">
                    {i.status !== "activa" ? (
                      <button className="font-medium text-brand-800 hover:underline" onClick={() => patch(i.slug, { status: "activa" }, "activada")}>Activar</button>
                    ) : (
                      <button className="font-medium text-red-700 hover:underline" onClick={() => confirm(`Suspender ${i.name}? Sai do catálogo e o portal fica bloqueado.`) && patch(i.slug, { status: "suspensa" }, "suspensa")}>Suspender</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
