// ponytail: um só idioma por agora; trocar por next-intl quando entrar o 2.º idioma.
export const locale = "pt-MZ";
export const timeZone = "Africa/Maputo";

// useGrouping "always": em pt-PT "7335" ficaria sem separador.
const mzn = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" } as Intl.NumberFormatOptions);

/** 123456 centavos -> "1 234,56 MT" */
export const formatMZN = (centavos: number | null | undefined) =>
  centavos == null ? "—" : `${mzn.format(centavos / 100)} MT`;

export const formatDateTime = (d: Date | string) =>
  new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(d));

/** "841234567" | "+258 84 123 4567" -> "+258841234567" */
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

export const REQUEST_STATUS: Record<string, string> = {
  AGUARDA_PAGAMENTO: "A aguardar pagamento",
  SUBMETIDO: "Submetido à instituição",
  EM_ANALISE: "Em análise",
  PENDENTE_INFO: "Falta informação",
  APROVADO: "Aprovado",
  PRONTO: "Pronto para levantamento",
  CONCLUIDO: "Concluído",
  REJEITADO: "Rejeitado",
  CANCELADO: "Cancelado",
};

export const LEVEL_LABEL: Record<number, string> = {
  1: "Consulta e pagamento imediato",
  2: "Pagamento por referência",
  3: "Pedido com documentos",
};
