import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/** Preferências pequenas do aparelho (ex.: já viu as boas-vindas). Na web usa o localStorage. */
export async function getItem(key: string): Promise<string | null> {
  try {
    return Platform.OS === "web" ? globalThis.localStorage?.getItem(key) ?? null : await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    /* sem armazenamento: as boas-vindas voltam a aparecer, nada mais */
  }
}

export const ONBOARDED = "pagamoz.bem-vindo";
