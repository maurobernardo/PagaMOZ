import { ArrowLeft, ArrowRight, ListChecks } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { Eyebrow } from "@/components/eyebrow";
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
      <div className="glass inline-flex rounded-full p-1.5">
        <Link href={`/servicos?categoria=${options[0].category}`} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold hover:bg-ink hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Voltar aos serviços
        </Link>
      </div>
      <section className="mt-6 rounded-[2rem] bg-ink px-6 py-10 text-white sm:px-10">
        <Eyebrow dark icon={ListChecks}>Passo 1 de 2</Eyebrow>
        <h1 className="mt-5 text-4xl font-bold leading-[1.05] sm:text-5xl">{g.title}</h1>
        <p className="mt-3 text-lg text-white/70">{g.prompt}.</p>
      </section>
      <ul className="mt-6 grid gap-3">
        {options.map((s) => (
          <li key={s.id}>
            <Link href={`/servicos/${s.id}`}
              className="group flex min-h-20 items-center gap-4 rounded-[var(--radius-card)] border border-line bg-white p-5 transition hover:border-ink hover:shadow-xl">
              <BrandMark slug={s.institution.slug} name={s.group?.option ?? s.institution.name} size={56} className="!rounded-2xl" />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-2xl font-bold">{s.group?.option}</span>
                <span className="block truncate text-sm text-muted">{s.institution.name === s.group?.option ? s.name : s.institution.name}{s.pricing === "fixo" && s.amount ? ` · ${formatMZN(s.amount)}` : ""}</span>
              </span>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-canvas transition group-hover:bg-ink group-hover:text-white"><ArrowRight className="h-5 w-5" /></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
