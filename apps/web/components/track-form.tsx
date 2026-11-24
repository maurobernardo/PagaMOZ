"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Acompanhar um pagamento (PMZ…) ou pedido (PED…) pelo código. */
export function TrackForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const c = code.trim().toUpperCase().replace(/\s/g, "");
        if (/^PMZ[0-9A-Z]{10}$/.test(c)) router.push(`/pagamento/${c}`);
        else if (/^PED[0-9A-Z]{10}$/.test(c)) router.push(`/pedido/${c}`);
        else setError("Código inválido. Começa por PMZ (pagamento) ou PED (pedido).");
      }}
    >
      <div className="flex items-center gap-2 rounded-full border border-line bg-canvas p-2 focus-within:border-ink">
        <label htmlFor="track" className="sr-only">Código do pagamento ou pedido</label>
        <input id="track" value={code} onChange={(e) => { setCode(e.target.value); setError(""); }}
          placeholder="PMZ… ou PED…" autoCapitalize="characters" aria-invalid={!!error} aria-describedby={error ? "track-err" : undefined}
          className="min-h-12 min-w-0 flex-1 bg-transparent px-4 font-mono text-base uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal placeholder:text-muted focus:outline-none" />
        <button disabled={!ready} className="frame-none inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-6 font-semibold text-white transition hover:bg-ink/85 disabled:opacity-50">
          Acompanhar <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      {error ? <p id="track-err" role="alert" className="mt-2 px-4 text-sm font-medium text-accent">{error}</p> : null}
    </form>
  );
}
