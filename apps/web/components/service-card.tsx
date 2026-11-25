import { ArrowUpRight, Radio, Tag, Wallet } from "lucide-react";
import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
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
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-canvas transition duration-300 group-hover:bg-ink group-hover:text-white">
            <CategoryIcon slug={s.category} />
          </span>
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
