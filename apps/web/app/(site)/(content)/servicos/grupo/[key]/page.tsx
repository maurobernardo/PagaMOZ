import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { api } from "@/lib/api";
import { formatMZN } from "@/lib/i18n";

export default async function Grupo({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { data } = await api.GET("/api/catalog/services", { params: { query: {} } });
  const options = (data?.results ?? []).filter((s) => s.group?.key === key);
  if (!options.length) notFound();
  const g = options[0].group!;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="inline-flex">
        <Link href={`/servicos?categoria=${options[0].category}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold hover:border-ink">
          <ArrowLeft className="h-4 w-4" /> Voltar aos serviços
        </Link>
      </div>
      {/* Telemóvel primeiro: título curto e as opções logo à vista, em grelha de cartões. */}
      <header className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Passo 1 de 2</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-5xl">{g.title}</h1>
        <p className="mt-1 text-muted">{g.prompt}.</p>
      </header>
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {options.map((s) => (
          <li key={s.id}>
            <Link href={`/servicos/${s.id}`}
              className="group flex h-full flex-col items-start gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 transition hover:border-ink hover:shadow-xl active:scale-[0.98]">
              <BrandMark slug={s.institution.slug} name={s.group?.option ?? s.institution.name} size={52} className="!rounded-2xl" />
              <span className="min-w-0">
                <span className="block font-display text-lg font-bold leading-tight">{s.group?.option}</span>
                <span className="mt-1 line-clamp-2 block text-xs leading-snug text-muted">
                  {s.institution.name === s.group?.option ? s.name : s.institution.name}{s.pricing === "fixo" && s.amount ? ` · ${formatMZN(s.amount)}` : ""}
                </span>
              </span>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold">Escolher <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
