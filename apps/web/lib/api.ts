import { createApiClient, type components } from "@pagamoz/api-client";

export type Schemas = components["schemas"];
export type Service = Schemas["ServicePublic"];
export type Category = Schemas["Category"];
export type Payment = Schemas["Payment"];
export type Quote = Schemas["QuoteResponse"];
export type ServiceRequest = Schemas["RequestPublic"];

export const API_URL = process.env.API_URL ?? "http://localhost:8000";
const isServer = typeof window === "undefined";

// No browser a API é servida pelo mesmo domínio (proxy /api no next.config) -> cookies first-party.
export const api = createApiClient(isServer ? API_URL : "");

export function csrfToken(): string {
  if (isServer) return "";
  return document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)?.[1] ?? "";
}

api.use({
  onRequest({ request }) {
    if (!isServer && request.method !== "GET") request.headers.set("X-CSRFToken", csrfToken());
    return request;
  },
});

/** Mensagem legível a partir de um erro DRF ({detail} | {campo: [..]} | {fields: {..}}). */
export function errorMessage(err: unknown, fallback = "Ocorreu um erro. Tente novamente."): string {
  if (!err || typeof err !== "object") return fallback;
  const e = err as Record<string, unknown>;
  if (typeof e.detail === "string") return e.detail;
  const first = Object.values(e.fields && typeof e.fields === "object" ? e.fields : e)[0];
  if (typeof first === "string") return first;
  if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  return fallback;
}

export function fieldErrors(err: unknown): Record<string, string> {
  const f = (err as { fields?: unknown })?.fields;
  return f && typeof f === "object" ? (f as Record<string, string>) : {};
}

export const newIdempotencyKey = () => `web-${crypto.randomUUID()}`;
