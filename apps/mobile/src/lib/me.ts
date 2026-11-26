import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api, ApiError } from "./api";

export type Me = { phone: string; name: string; first_name?: string; last_name?: string; email?: string; province?: string; district?: string };

/** Sessão actual (null = sem conta; undefined = a carregar). Recarrega ao voltar ao ecrã. */
export function useMe() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const reload = useCallback(() => {
    api<Me>("/api/me").then(setMe).catch((e) => setMe(e instanceof ApiError ? null : null));
  }, []);
  useFocusEffect(reload);
  return { me, setMe, reload };
}

/** As 11 províncias de Moçambique (igual à API). */
export const PROVINCES = [
  "Maputo Cidade", "Maputo Província", "Gaza", "Inhambane", "Sofala", "Manica",
  "Tete", "Zambézia", "Nampula", "Cabo Delgado", "Niassa",
];

export const initials = (m: Me) =>
  ((m.first_name?.[0] ?? "") + (m.last_name?.[0] ?? "")).toUpperCase() || m.phone.slice(-2);

export const prettyPhone = (p: string) => p.replace(/^\+258(\d{2})(\d{3})(\d{4})$/, "$1 $2 $3");
