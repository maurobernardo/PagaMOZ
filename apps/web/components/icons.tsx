// Ícones em traço (estilo Lucide, ISC). Inline para não carregar biblioteca.
const PATHS: Record<string, string> = {
  "id-card": "M3 5h18v14H3zM7 10a2 2 0 1 0 4 0 2 2 0 1 0-4 0M6 16c.7-1.5 2-2 3-2s2.3.5 3 2M14 9h4M14 13h4",
  car: "M5 17h14M6 17v2M18 17v2M3 13l2-6h14l2 6v4H3zM7 13h.01M17 13h.01",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  landmark: "M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M2 10 12 3l10 7z",
  "graduation-cap": "M22 9 12 4 2 9l10 5 10-5zM6 11v5c3 2 9 2 12 0v-5M22 9v6",
  "heart-pulse": "M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 12 5 5.5 5.5 0 0 0 2 8.5C2 10.8 3.5 12.5 5 14l7 7zM3.5 12h4l2-3 3 6 2-3h6",
  building: "M4 21V3h11v18M15 9h5v12M8 7h3M8 11h3M8 15h3M4 21h17",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 1 0 0-14M21 21l-4.3-4.3",
  check: "M5 12l5 5 9-10",
  x: "M6 6l12 12M18 6 6 18",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M12 7v5l3 2",
  arrow: "M5 12h14M13 6l6 6-6 6",
  share: "M4 12v7h16v-7M12 3v12M7 8l5-5 5 5",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  user: "M12 4a4 4 0 1 0 0 8 4 4 0 1 0 0-8M4 21c1-4 4.5-6 8-6s7 2 8 6",
};

export function Icon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={PATHS[name] ?? PATHS.grid} />
    </svg>
  );
}
