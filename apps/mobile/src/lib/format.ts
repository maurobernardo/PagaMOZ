/** 123456 centavos -> "1 234,56 MT" (formatação manual: o Intl do Hermes varia entre aparelhos). */
export function formatMZN(centavos: number | null | undefined): string {
  if (centavos == null) return "-";
  const neg = centavos < 0;
  const [int, dec] = (Math.abs(centavos) / 100).toFixed(2).split(".");
  return `${neg ? "-" : ""}${int.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${dec} MT`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** Data e hora de Maputo (UTC+2, sem horário de verão). */
export function formatDateTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 2 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length === 9) d = "258" + d;
  return "+" + d;
}

export const isValidPhone = (raw: string) => /^\+258[28]\d{8}$/.test(normalizePhone(raw));

export const METHOD_LABEL: Record<string, string> = {
  mpesa: "M-Pesa",
  emola: "e-Mola",
  mkesh: "mKesh",
  cartao: "Cartão Visa / Mastercard",
  referencia_bancaria: "Referência bancária",
  qr: "QR Code",
};

/** Vodacom 84/85, Movitel 86/87, Tmcel 82/83. */
export const WALLET_PREFIXES: Record<string, string[]> = { mpesa: ["84", "85"], emola: ["86", "87"], mkesh: ["82", "83"] };

export const PAYMENT_STATUS: Record<string, { label: string; tone: "ok" | "wait" | "bad" | "info" }> = {
  CRIADA: { label: "Criado", tone: "wait" },
  PENDENTE: { label: "A aguardar confirmação", tone: "wait" },
  CONFIRMADA: { label: "Pago", tone: "ok" },
  LIQUIDADA: { label: "Pago e entregue à instituição", tone: "ok" },
  FALHADA: { label: "Falhou", tone: "bad" },
  EXPIRADA: { label: "Expirou", tone: "bad" },
  REVERTIDA: { label: "Devolvido", tone: "info" },
  EM_DISPUTA: { label: "Em análise", tone: "info" },
};

if (__DEV__) {
  console.assert(formatMZN(123456) === "1 234,56 MT", "formatMZN");
  console.assert(normalizePhone("84 123 4567") === "+258841234567", "normalizePhone");
}
