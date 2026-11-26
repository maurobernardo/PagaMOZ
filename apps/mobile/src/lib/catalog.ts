import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, type Schemas, type Service } from "./api";

type Page = { count: number; results: Service[] };

/** Lista de serviços (opcionalmente filtrada) com estado de carga, erro e "puxar para actualizar". */
export function useServices(query: { category?: string; q?: string } = {}) {
  const [data, setData] = useState<Service[] | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v) as [string, string][]).toString();

  const load = useCallback(async () => {
    setError("");
    const key = `pagamoz.cache.services.${qs}`;
    try {
      const list = (await api<Page>(`/api/catalog/services${qs ? `?${qs}` : ""}`)).results;
      setData(list);
      setOffline(false);
      AsyncStorage.setItem(key, JSON.stringify(list)).catch(() => {});
    } catch (e) {
      // Sem rede: mostra a última lista guardada neste telemóvel.
      const cached = await AsyncStorage.getItem(key).catch(() => null);
      if (cached) { setData(JSON.parse(cached)); setOffline(true); }
      else setError(errorMessage(e));
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
  return { data, error, refreshing, refresh, offline };
}

export function useCategories() {
  const [data, setData] = useState<Schemas["Category"][]>([]);
  useEffect(() => {
    api<Schemas["Category"][]>("/api/catalog/categories")
      .then((c) => { setData(c); AsyncStorage.setItem("pagamoz.cache.categories", JSON.stringify(c)).catch(() => {}); })
      .catch(async () => {
        const cached = await AsyncStorage.getItem("pagamoz.cache.categories").catch(() => null);
        if (cached) setData(JSON.parse(cached));
      });
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
