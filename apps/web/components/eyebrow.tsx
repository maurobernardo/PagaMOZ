import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// Sem "use client": pode ser usado em páginas de servidor com um ícone como prop.
/** Chip translúcido para contexto ("Portal da instituição · Admin"). */
export function Eyebrow({ children, dark = false, icon: I = ChevronRight }: { children: ReactNode; dark?: boolean; icon?: LucideIcon }) {
  return (
    <span className={`${dark ? "glass-dark text-white/80" : "glass text-ink/70"} inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]`}>
      <I className="h-3.5 w-3.5 text-accent" strokeWidth={2.4} aria-hidden />
      {children}
    </span>
  );
}
