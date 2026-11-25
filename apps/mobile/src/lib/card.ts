import * as Crypto from "expo-crypto";

export type CardSummary = { token: string; brand: "visa" | "mastercard"; last4: string; exp_month: number; exp_year: number; holder: string };

/** Visa: começa por 4. Mastercard: 51–55 ou 2221–2720. */
export function detectBrand(num: string): CardSummary["brand"] | null {
  if (/^4/.test(num)) return "visa";
  const p2 = Number(num.slice(0, 2));
  const p4 = Number(num.slice(0, 4));
  if ((p2 >= 51 && p2 <= 55) || (num.length >= 4 && p4 >= 2221 && p4 <= 2720)) return "mastercard";
  return null;
}

export function luhn(num: string): boolean {
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let d = Number(num[num.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return num.length >= 13 && sum % 10 === 0;
}

/** Valida e resume o cartão. O número completo e o CVV nunca saem do telemóvel. */
export function cardSummary(number: string, exp: string, cvv: string, holder: string): { summary: CardSummary | null; errors: Record<string, string> } {
  const digits = number.replace(/\D/g, "");
  const brand = detectBrand(digits);
  const errors: Record<string, string> = {};
  if (!brand) errors.number = "Só aceitamos Visa e Mastercard.";
  else if (digits.length < 16 || !luhn(digits)) errors.number = "Número de cartão inválido.";
  const m = exp.match(/^(\d{2})\/?(\d{2})$/);
  const month = m ? Number(m[1]) : 0;
  const year = m ? 2000 + Number(m[2]) : 0;
  const now = new Date();
  if (!m || month < 1 || month > 12) errors.exp = "Use MM/AA.";
  else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) errors.exp = "Cartão expirado.";
  if (!/^\d{3}$/.test(cvv)) errors.cvv = "3 algarismos no verso.";
  if (holder.trim().length < 3) errors.holder = "Nome como está no cartão.";
  if (Object.keys(errors).length || !brand) return { summary: null, errors };
  // ponytail: em produção o token vem do SDK do adquirente; aqui é gerado no aparelho.
  const token = "tok_" + Array.from(Crypto.getRandomBytes(18), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"[b % 57]).join("");
  return { summary: { token, brand, last4: digits.slice(-4), exp_month: month, exp_year: year, holder: holder.trim().toUpperCase() }, errors };
}

export const formatCardNumber = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
export const formatExp = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

if (__DEV__) {
  console.assert(luhn("4111111111111111") && !luhn("4111111111111112"), "luhn");
  console.assert(detectBrand("5500") === "mastercard" && detectBrand("4111") === "visa", "detectBrand");
}
