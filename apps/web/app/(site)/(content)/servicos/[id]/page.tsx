import type { Metadata } from "next";
import { ArrowLeft, Landmark, QrCode, Share2 } from "lucide-react";
import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
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

  const price = s.pricing === "fixo" ? formatMZN(s.amount) : s.pricing === "consulta" ? "Valor consultado" : "Valor à sua escolha";

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="glass inline-flex rounded-full p-1.5">
          <Link href={`/servicos?categoria=${s.category}`} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold hover:bg-ink hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Voltar aos serviços
          </Link>
        </div>
        <div className="mt-6 rounded-[2rem] bg-ink p-7 text-white">
          <div className="flex items-start justify-between gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-ink"><CategoryIcon slug={s.category} /></span>
            <span className="glass-dark rounded-full px-3 py-1 text-xs font-semibold text-white/80">{LEVEL_LABEL[s.integration_level]}</span>
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-white/50">{s.institution.name}</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{s.name}</h1>
          {s.description ? <p className="mt-3 text-white/65">{s.description}</p> : null}
          <p className="mt-8 font-display text-3xl font-bold">{price}</p>
        </div>
        <ul className="mt-5 grid gap-2 text-sm">
          {[
            [Landmark, "O valor vai directamente para a conta da instituição."],
            [QrCode, "Recebe um comprovativo com QR, verificável por qualquer pessoa."],
            [Share2, "Pode pedir a outra pessoa para pagar por si."],
          ].map(([I, t]) => {
            const Icon = I as typeof Landmark;
            return (
              <li key={String(t)} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
                <Icon className="h-4 w-4 shrink-0" /> {String(t)}
              </li>
            );
          })}
        </ul>
      </aside>
      <div>
        <PayFlow service={s} prefill={prefill} scenarios={scen?.demo_mode ? scen.scenarios : {}} />
      </div>
    </div>
  );
}
