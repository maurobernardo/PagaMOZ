/**
 * Logótipo PagaMOZ: um "P" branco num quadrado preto, com um ponto vermelho na barriga —
 * lê-se como letra e como carimbo de "pago". O ponto é o único vermelho fixo da marca.
 */
export function LogoMark({ className = "h-9 w-9", inverted = false }: { className?: string; inverted?: boolean }) {
  const bg = inverted ? "#ffffff" : "#0b0b0c";
  const fg = inverted ? "#0b0b0c" : "#ffffff";
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="11" fill={bg} />
      <path d="M13 31V9h8.5a7.5 7.5 0 0 1 0 15H17" fill="none" stroke={fg} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="21.2" cy="16.5" r="2.6" fill="#e0262f" />
    </svg>
  );
}

export function Logo({ inverted = false, className = "" }: { inverted?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark inverted={inverted} />
      <span className={`font-display text-xl font-bold tracking-tight ${inverted ? "text-white" : "text-ink"}`}>
        paga<span className="font-extrabold">moz</span>
      </span>
    </span>
  );
}
