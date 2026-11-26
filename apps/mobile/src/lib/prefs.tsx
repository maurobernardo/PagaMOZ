import { getLocales } from "expo-localization";
import { createContext, useContext, type ReactNode } from "react";
import { Appearance } from "react-native";
import { getItem, setItem } from "./storage";

export type ThemePref = "system" | "light" | "dark";
export type Lang = "pt" | "en";
export type Prefs = {
  theme: ThemePref;
  lang: Lang;
  haptics: boolean;
  notifyPayments: boolean;
  notifyReminders: boolean;
  analytics: boolean;
  biometric: boolean;
};

const KEY = "pagamoz.prefs";

export const DEFAULT_PREFS: Prefs = {
  theme: "system",
  lang: getLocales()[0]?.languageCode === "en" ? "en" : "pt",
  haptics: true,
  notifyPayments: true,
  notifyReminders: false,
  analytics: false, // privacidade por omissão: sem estatísticas de uso até a pessoa aceitar
  biometric: false,
};

export async function loadPrefs(): Promise<Prefs> {
  const raw = await getItem(KEY);
  try {
    return { ...DEFAULT_PREFS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export const savePrefs = (p: Prefs) => setItem(KEY, JSON.stringify(p));

export const resolveDark = (t: ThemePref) => (t === "system" ? Appearance.getColorScheme() === "dark" : t === "dark");

type Ctx = { prefs: Prefs; set: (patch: Partial<Prefs>) => void };
export const PrefsContext = createContext<Ctx>({ prefs: DEFAULT_PREFS, set: () => {} });
export const usePrefs = () => useContext(PrefsContext);

export function PrefsProvider({ value, children }: { value: Ctx; children: ReactNode }) {
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}
