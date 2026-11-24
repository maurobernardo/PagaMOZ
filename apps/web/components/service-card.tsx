import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import type { Service } from "@/lib/api";
import { formatMZN, LEVEL_LABEL } from "@/lib/i18n";

export function ServiceCard({ s }: { s: Service }) {
  const price = s.pricing === "fixo" ? formatMZN(s.amount) : s.pricing === "consulta" ? "Valor consultado" : "Valor à escolha";
  return (
    <li>
      <Link href={`/servicos/${s.id}`}
        className="group flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-ink hover:shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-canvas transition group-hover:bg-ink group-hover:text-white">
            <CategoryIcon slug={s.category} />
          </span>
          <ArrowUpRight className="h-5 w-5 text-muted transition group-hover:text-ink" aria-hidden />
        </div>
        <span className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted">{s.institution.name}</span>
        <span className="mt-1 font-display text-lg font-bold leading-snug">{s.name}</span>
        <span className="mt-auto flex items-end justify-between gap-2 pt-5 text-sm">
          <span className="text-muted">{LEVEL_LABEL[s.integration_level]}</span>
          <span className="whitespace-nowrap font-semibold">{price}</span>
        </span>
      </Link>
    </li>
  );
}
