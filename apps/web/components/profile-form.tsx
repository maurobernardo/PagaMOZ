"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import places from "@/lib/districts.json";

/** Províncias e distritos oficiais (Lei 26/2013), os mesmos que a API valida. */
const DISTRICTS: Record<string, string[]> = places.provincias;

type Profile = { first_name: string; last_name: string; email: string; province: string; district: string };

const selectCls = "mt-1.5 block min-h-14 w-full rounded-2xl border bg-white px-4 text-base focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/5 disabled:opacity-50";

/** Nome, apelido, email, província e distrito: no registo e em "A minha conta". */
export function ProfileForm({ initial, onSaved, cta = "Guardar" }: { initial: Partial<Profile>; onSaved: () => void; cta?: string }) {
  const [f, setF] = useState<Profile>({
    first_name: initial.first_name ?? "", last_name: initial.last_name ?? "", email: initial.email ?? "",
    province: initial.province ?? "", district: initial.district ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.first_name.trim().length < 2) errs.first_name = "Escreva o seu nome.";
    if (f.last_name.trim().length < 2) errs.last_name = "Escreva o seu apelido.";
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) errs.email = "Email inválido.";
    if (!f.province) errs.province = "Escolha a província.";
    if (!f.district) errs.district = "Escolha o distrito.";
    setErrors(errs);
    if (Object.keys(errs).length) return setError("Corrija os campos assinalados.");
    setBusy(true);
    setError("");
    const r = await api.PATCH("/api/me", { body: f as never });
    setBusy(false);
    if (!r.response.ok) {
      const fe = (r.error as unknown as { fields?: Record<string, string> } | undefined)?.fields;
      if (fe) setErrors(fe);
      return setError(errorMessage(r.error));
    }
    onSaved();
  }

  return (
    <form onSubmit={save} className="space-y-5" noValidate>
      {error ? <Alert>{error}</Alert> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="first_name" label="Nome" autoComplete="given-name" value={f.first_name} error={errors.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
        <Field id="last_name" label="Apelido" autoComplete="family-name" value={f.last_name} error={errors.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} />
      </div>
      <Field id="email" label="Email (opcional)" type="email" autoComplete="email" value={f.email} error={errors.email} onChange={(e) => setF({ ...f, email: e.target.value.trim() })} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="province" className="block text-sm font-semibold">Província</label>
          <select id="province" value={f.province} className={`${selectCls} ${errors.province ? "border-accent" : "border-line"}`}
            onChange={(e) => setF({ ...f, province: e.target.value, district: DISTRICTS[e.target.value]?.includes(f.district) ? f.district : "" })}>
            <option value="">Escolha a província</option>
            {Object.keys(DISTRICTS).map((p) => <option key={p}>{p}</option>)}
          </select>
          {errors.province ? <p className="mt-1.5 text-sm text-accent">{errors.province}</p> : null}
        </div>
        <div>
          <label htmlFor="district" className="block text-sm font-semibold">Distrito</label>
          <select id="district" value={f.district} disabled={!f.province} className={`${selectCls} ${errors.district ? "border-accent" : "border-line"}`}
            onChange={(e) => setF({ ...f, district: e.target.value })}>
            <option value="">{f.province ? "Escolha o distrito" : "Escolha primeiro a província"}</option>
            {(DISTRICTS[f.province] ?? []).map((d) => <option key={d}>{d}</option>)}
          </select>
          {errors.district ? <p className="mt-1.5 text-sm text-accent">{errors.district}</p> : null}
        </div>
      </div>
      <Button type="submit" disabled={busy} className="w-full !min-h-12"><Save className="h-4 w-4" /> {busy ? "A guardar…" : cta}</Button>
    </form>
  );
}
