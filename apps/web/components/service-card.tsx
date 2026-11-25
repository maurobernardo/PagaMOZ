import { ArrowUpRight, ListChecks, Radio, Tag, Wallet } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import type { Service } from "@/lib/api";
import { formatMZN } from "@/lib/i18n";

export function ServiceCard({ s }: { s: Service }) {
  const price = s.variants.length
    ? `desde ${formatMZN(Math.min(...s.variants.map((v) => v.amount)))}`
    : s.pricing === "fixo" ? formatMZN(s.amount) : s.pricing === "consulta" ? "Valor da instituição" : "Valor à sua escolha";
  const kind = s.lookup ? { icon: Radio, label: "Consulta em tempo real" } : s.pricing === "fixo" ? { icon: Tag, label: "Preço fixo" } : { icon: Wallet, label: "Valor livre" };
  return (
    <li>
      <Link href={`/servicos/${s.id}`}
        className="group flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-ink hover:shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <BrandMark slug={s.institution.slug} name={s.institution.name} size={48} className="!rounded-2xl" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-[11px] font-semibold text-ink/70">
            <kind.icon className="h-3.5 w-3.5" /> {kind.label}
          </span>
        </div>
        <span className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted">{s.institution.name}</span>
        <span className="mt-1 font-display text-xl font-bold leading-snug">{s.name}</span>
        <span className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-4 text-sm">
          <span className="font-semibold">{price}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-muted transition group-hover:text-ink">Pagar <ArrowUpRight className="h-4 w-4" /></span>
        </span>
      </Link>
    </li>
  );
}

/** Um cartão para vários serviços do mesmo assunto (ex.: recarga em qualquer operadora). */
export function GroupCard({ s, options }: { s: Service; options: Service[] }) {
  const g = s.group!;
  return (
    <li>
      <Link href={`/servicos/grupo/${g.key}`}
        className="group flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-ink hover:shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <span className="flex -space-x-3">
            {[...new Map(options.map((o) => [o.institution.slug, o])).values()].map((o) => (
              <BrandMark key={o.id} slug={o.institution.slug} name={o.group?.option ?? o.institution.name} size={48} className="!rounded-2xl border-2 border-white shadow-sm" />
            ))}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-[11px] font-semibold text-ink/70">
            <ListChecks className="h-3.5 w-3.5" /> {options.length} opções
          </span>
        </div>
        <span className="mt-6 font-display text-xl font-bold leading-snug">{g.title}</span>
        <span className="mb-5 mt-4 flex flex-wrap gap-2">
          {options.map((o) => <span key={o.id} className="inline-flex items-center gap-2 rounded-full bg-ink py-1 pl-1 pr-3.5 text-sm font-semibold text-white"><BrandMark slug={o.institution.slug} name={o.group?.option ?? ""} size={26} className="!rounded-full !text-[10px]" />{o.group?.option}</span>)}
        </span>
        <span className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-4 text-sm">
          <span className="font-semibold">{g.prompt}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-muted transition group-hover:text-ink">Escolher <ArrowUpRight className="h-4 w-4" /></span>
        </span>
      </Link>
    </li>
  );
}
