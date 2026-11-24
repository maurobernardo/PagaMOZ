import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PayFlow } from "./pay-flow";
import { api } from "@/lib/api";
import { formatMZN, LEVEL_LABEL } from "@/lib/i18n";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> };

async function load(id: string) {
  if (!/^\d+$/.test(id)) return null;
  const { data } = await api.GET("/api/catalog/services/{id}", { params: { path: { id: Number(id) } } });
  return data ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await load((await params).id);
  return { title: s ? `${s.name} — ${s.institution.name}` : "Serviço" };
}

export default async function ServicePage({ params, searchParams }: Props) {
  const s = await load((await params).id);
  if (!s) notFound();
  const prefill = await searchParams;
  const { data: scen } = await api.GET("/api/payments/scenarios");

  return (
    <div className="mx-auto max-w-xl">
      <nav aria-label="Caminho" className="mb-3 text-sm text-slate-600">
        <Link href={`/servicos?categoria=${s.category}`} className="underline-offset-2 hover:underline">
          ← Voltar aos serviços
        </Link>
      </nav>
      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">{s.institution.name}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{s.name}</h1>
      <p className="mt-2 text-slate-600">
        {LEVEL_LABEL[s.integration_level]}
        {s.pricing === "fixo" ? ` · ${formatMZN(s.amount)}` : null}
      </p>
      {s.description ? <p className="mt-3 text-slate-700">{s.description}</p> : null}
      <div className="mt-6">
        <PayFlow service={s} prefill={prefill} scenarios={scen?.demo_mode ? scen.scenarios : {}} />
      </div>
    </div>
  );
}
