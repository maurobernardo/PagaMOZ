import type { ReactNode } from "react";

/** Tabela do portal: cartão branco, cabeçalho discreto, linhas com hover. */
export function Table({ caption, head, children, minWidth = 760 }: { caption: string; head: ReactNode[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-soft)]">
      <table className="w-full text-sm" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {head.map((h, i) => <th key={i} scope="col" className="px-5 py-4 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line [&_td]:px-5 [&_td]:py-3.5 [&_tr]:transition [&_tr:hover]:bg-canvas/60">{children}</tbody>
      </table>
    </div>
  );
}

export function TableEmpty({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="!py-14 text-center text-muted">{children}</td>
    </tr>
  );
}

export const filterInput =
  "min-h-10 rounded-full border-0 bg-white px-4 text-sm text-ink shadow-[var(--shadow-soft)] ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-ink";
