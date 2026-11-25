import Constants from "expo-constants";
import { Platform } from "react-native";
import type { components } from "../../../../packages/api-client/src/schema";

export type Schemas = components["schemas"];
export type Service = Schemas["ServicePublic"];
export type Payment = Schemas["Payment"];

/**
 * Mesma API da web. EXPO_PUBLIC_API_URL define-a; sem isso usa o IP do computador que serve o Metro
 * (telemóvel na mesma rede) ou 10.0.2.2 no emulador Android.
 */
function baseUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, "");
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host) return `http://${host}:8000`;
  return Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";
}
export const API = baseUrl();

let csrf = "";
async function csrfToken(force = false): Promise<string> {
  if (!csrf || force) {
    const r = await fetch(`${API}/api/auth/csrf`, { credentials: "include" });
    csrf = (await r.json()).csrf;
  }
  return csrf;
}

export class ApiError extends Error {
  constructor(public status: number, public body: Record<string, unknown>) {
    super(errorMessage(body));
  }
}

/** Pedido à API com a sessão (cookies nativos) e o token CSRF nos POST. */
export async function api<T>(path: string, init: { method?: string; body?: unknown; form?: FormData; headers?: Record<string, string> } = {}): Promise<T> {
  const method = init.method ?? (init.body || init.form ? "POST" : "GET");
  const send = async (retry: boolean): Promise<Response> => {
    const headers: Record<string, string> = { Accept: "application/json", ...init.headers };
    if (method !== "GET") {
      headers["X-CSRFToken"] = await csrfToken(retry);
      headers.Referer = API + "/";
    }
    if (init.body) headers["Content-Type"] = "application/json";
    return fetch(`${API}${path}`, { method, headers, credentials: "include", body: init.form ?? (init.body ? JSON.stringify(init.body) : undefined) });
  };
  let res = await send(false);
  if (res.status === 403 && method !== "GET") res = await send(true); // token rodou (ex.: depois de entrar)
  const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export function errorMessage(err: unknown, fallback = "Ocorreu um erro. Tente novamente."): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof TypeError) return "Sem ligação à internet. Tente de novo.";
  if (!err || typeof err !== "object") return fallback;
  const e = err as Record<string, unknown>;
  if (typeof e.detail === "string") return e.detail;
  if (typeof e.mensagem === "string") return e.mensagem;
  const first = Object.values(e.fields && typeof e.fields === "object" ? e.fields : e)[0];
  if (typeof first === "string") return first;
  if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  return fallback;
}

export function fieldErrors(err: unknown): Record<string, string> {
  const f = err instanceof ApiError ? err.body.fields : undefined;
  return f && typeof f === "object" ? (f as Record<string, string>) : {};
}

export const newKey = () => `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
