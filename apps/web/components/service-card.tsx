import Link from "next/link";
import type { Service } from "@/lib/api";
import { formatMZN, LEVEL_LABEL } from "@/lib/i18n";

export function ServiceCard({ s }: { s: Service }) {
  const price =
    s.pricing === "fixo" ? formatMZN(s.amount) : s.pricing === "consulta" ? "Valor consultado" : "Valor à escolha";
  return (
    <li>
      <Link
        href={`/servicos/${s.id}`}
        className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-600 hover:shadow focus-visible:outline-3 focus-visible:outline-brand-600"
      >
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.institution.name}</span>
        <span className="mt-1 font-semibold text-slate-900">{s.name}</span>
        <span className="mt-auto flex items-end justify-between gap-2 pt-3 text-sm">
          <span className="text-slate-600">{LEVEL_LABEL[s.integration_level]}</span>
          <span className="whitespace-nowrap font-semibold text-brand-800">{price}</span>
        </span>
      </Link>
    </li>
  );
}
