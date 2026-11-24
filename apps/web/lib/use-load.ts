"use client";

import { useEffect, useState } from "react";

/** Pequeno helper de leitura com estado de carregamento/erro. */
export function useLoad<T>(fn: () => Promise<{ data?: T; error?: unknown }>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    fn().then((r) => live && (r.data ? setData(r.data) : setError(true)), () => live && setError(true));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, reload: () => setTick((t) => t + 1) };
}
