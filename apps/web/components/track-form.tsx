"use client";

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
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        const c = code.trim().toUpperCase().replace(/\s/g, "");
        if (/^PMZ[0-9A-Z]{10}$/.test(c)) router.push(`/pagamento/${c}`);
        else if (/^PED[0-9A-Z]{10}$/.test(c)) router.push(`/pedido/${c}`);
        else setError("Código inválido. Começa por PMZ (pagamento) ou PED (pedido).");
      }}
    >
      <label htmlFor="track" className="sr-only">
        Código do pagamento ou pedido
      </label>
      <input
        id="track"
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setError("");
        }}
        placeholder="PMZ… ou PED…"
        autoCapitalize="characters"
        aria-invalid={!!error}
        aria-describedby={error ? "track-err" : undefined}
        className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-base uppercase focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
      />
      <button disabled={!ready} className="min-h-12 rounded-xl disabled:opacity-60 bg-white px-5 font-semibold text-brand-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
        Acompanhar
      </button>
      {error ? (
        <p id="track-err" role="alert" className="text-sm text-red-700 sm:basis-full">
          {error}
        </p>
      ) : null}
    </form>
  );
}
