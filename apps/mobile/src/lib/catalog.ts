import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, type Schemas, type Service } from "./api";

type Page = { count: number; results: Service[] };

/** Lista de serviços (opcionalmente filtrada) com estado de carga, erro e "puxar para actualizar". */
export function useServices(query: { category?: string; q?: string } = {}) {
  const [data, setData] = useState<Service[] | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v) as [string, string][]).toString();

  const load = useCallback(async () => {
    setError("");
    try {
      setData((await api<Page>(`/api/catalog/services${qs ? `?${qs}` : ""}`)).results);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [qs]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };
  return { data, error, refreshing, refresh };
}

export function useCategories() {
  const [data, setData] = useState<Schemas["Category"][]>([]);
  useEffect(() => {
    api<Schemas["Category"][]>("/api/catalog/categories").then(setData).catch(() => {});
  }, []);
  return data;
}

/** Um cartão por assunto: serviços do mesmo grupo (recarga, TV...) juntam-se. */
export type Entry = { kind: "service"; s: Service } | { kind: "group"; key: string; title: string; prompt: string; options: Service[] };

export function groupServices(list: Service[]): Entry[] {
  const out: Entry[] = [];
  const seen = new Map<string, Entry & { kind: "group" }>();
  for (const s of list) {
    if (!s.group) {
      out.push({ kind: "service", s });
      continue;
    }
    const g = seen.get(s.group.key);
    if (g) g.options.push(s);
    else {
      const e = { kind: "group" as const, key: s.group.key, title: s.group.title, prompt: s.group.prompt, options: [s] };
      seen.set(s.group.key, e);
      out.push(e);
    }
  }
  return out;
}
