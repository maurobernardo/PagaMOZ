"use client";

import { useState } from "react";

/**
 * Logótipo oficial em /public/logos/{slug}.svg (ou .png). Sem ficheiro, mostra as iniciais.
 * Os ficheiros só devem ser colocados com autorização da marca (ver public/logos/LEIA-ME.md).
 */
export function BrandMark({ slug, name, size = 48, className = "" }: { slug: string; name: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(`/logos/${slug}.svg`);
  const initials = name.replace(/\(.*?\)/g, "").split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const box = { width: size, height: size };
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} style={box} className={`shrink-0 rounded-xl bg-white object-contain p-1 ${className}`}
        onError={() => setSrc(src.endsWith(".svg") ? `/logos/${slug}.png` : null)} />
    );
  return (
    <span aria-label={name} role="img" style={box}
      className={`grid shrink-0 place-items-center rounded-xl bg-ink font-display text-sm font-bold text-white ${className}`}>{initials}</span>
  );
}
