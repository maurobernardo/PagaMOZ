"use client";

import { CreditCard, Lock } from "lucide-react";
import { useMemo, useState } from "react";

export type CardSummary = { token: string; brand: "visa" | "mastercard"; last4: string; exp_month: number; exp_year: number; holder: string };
type Brand = CardSummary["brand"] | null;

/** Visa: começa por 4. Mastercard: 51–55 ou 2221–2720. */
export function detectBrand(num: string): Brand {
  if (/^4/.test(num)) return "visa";
  const p2 = Number(num.slice(0, 2));
  const p4 = Number(num.slice(0, 4));
  if ((p2 >= 51 && p2 <= 55) || (num.length >= 4 && p4 >= 2221 && p4 <= 2720)) return "mastercard";
  return null;
}

/** Algoritmo de Luhn: apanha erros de digitação no número do cartão. */
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

function tokenize(): string {
  // ponytail: em produção o token vem do adquirente (campos alojados por ele); aqui é gerado no browser.
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return "tok_" + Array.from(bytes, (b) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"[b % 57]).join("");
}

export type CardState = { valid: boolean; summary: CardSummary | null; errors: Record<string, string> };

export function useCardForm() {
  const [number, setNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [holder, setHolder] = useState("");
  const [touched, setTouched] = useState(false);

  const digits = number.replace(/\D/g, "");
  const brand = detectBrand(digits);
  const state = useMemo<CardState>(() => {
    const errors: Record<string, string> = {};
    if (!brand) errors.number = "Só aceitamos Visa e Mastercard.";
    else if (digits.length < 16 || !luhn(digits)) errors.number = "Número de cartão inválido.";
    const m = exp.match(/^(\d{2})\/(\d{2})$/);
    const month = m ? Number(m[1]) : 0;
    const year = m ? 2000 + Number(m[2]) : 0;
    const now = new Date();
    if (!m || month < 1 || month > 12) errors.exp = "Use MM/AA.";
    else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) errors.exp = "Cartão expirado.";
    if (!/^\d{3}$/.test(cvv)) errors.cvv = "3 dígitos no verso.";
    if (holder.trim().length < 3) errors.holder = "Como aparece no cartão.";
    const valid = Object.keys(errors).length === 0;
    return {
      valid,
      errors,
      summary: valid && brand ? { token: tokenize(), brand, last4: digits.slice(-4), exp_month: month, exp_year: year, holder: holder.trim().toUpperCase() } : null,
    };
    // tokenize() só quando os dados mudam
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, exp, cvv, holder, brand]);

  const ui = (
    <CardFields
      number={number} exp={exp} cvv={cvv} holder={holder} brand={brand} errors={touched ? state.errors : {}}
      onNumber={(v) => setNumber(v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 "))}
      onExp={(v) => {
        const d = v.replace(/\D/g, "").slice(0, 4);
        setExp(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
      }}
      onCvv={(v) => setCvv(v.replace(/\D/g, "").slice(0, 3))}
      onHolder={setHolder}
    />
  );
  return { ui, state, touch: () => setTouched(true) };
}

function BrandMark({ brand, light = false }: { brand: Brand; light?: boolean }) {
  if (brand === "mastercard")
    return (
      <span className="flex items-center" aria-label="Mastercard">
        <span className="h-6 w-6 rounded-full bg-[#eb001b]" /><span className="-ml-2.5 h-6 w-6 rounded-full bg-[#f79e1b] mix-blend-multiply" />
      </span>
    );
  if (brand === "visa") return <span className={`font-display text-xl font-extrabold italic tracking-tight ${light ? "text-white" : "text-ink"}`}>VISA</span>;
  return <CreditCard className={`h-6 w-6 ${light ? "text-white/60" : "text-muted"}`} />;
}

function CardFields(p: {
  number: string; exp: string; cvv: string; holder: string; brand: Brand; errors: Record<string, string>;
  onNumber: (v: string) => void; onExp: (v: string) => void; onCvv: (v: string) => void; onHolder: (v: string) => void;
}) {
  const input = "mt-1.5 block min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base tracking-wide focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/5 aria-[invalid=true]:border-accent";
  const err = (k: string) => (p.errors[k] ? <p className="mt-1 text-sm font-medium text-accent">{p.errors[k]}</p> : null);
  return (
    <div className="space-y-5">
      {/* Pré-visualização */}
      <div className="relative mx-auto aspect-[1.586] w-full max-w-sm overflow-hidden rounded-3xl bg-ink p-6 text-white shadow-2xl">
        <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full border border-white/10" aria-hidden />
        <div className="absolute -right-4 top-10 h-40 w-40 rounded-full border border-white/10" aria-hidden />
        <div className="flex items-start justify-between">
          <span className="h-8 w-11 rounded-md bg-white/50" aria-hidden />
          <BrandMark brand={p.brand} light />
        </div>
        <p className="mt-8 font-mono text-lg tracking-[0.18em] sm:text-xl">{p.number || "•••• •••• •••• ••••"}</p>
        <div className="mt-5 flex items-end justify-between text-xs">
          <div><p className="text-white/50">Titular</p><p className="mt-0.5 font-semibold uppercase tracking-wider">{p.holder || "NOME APELIDO"}</p></div>
          <div className="text-right"><p className="text-white/50">Validade</p><p className="mt-0.5 font-mono font-semibold">{p.exp || "MM/AA"}</p></div>
        </div>
      </div>

      <div>
        <label htmlFor="cc-number" className="block text-sm font-semibold">Número do cartão</label>
        <div className="relative">
          <input id="cc-number" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" value={p.number}
            aria-invalid={!!p.errors.number} onChange={(e) => p.onNumber(e.target.value)} className={`${input} pr-16 font-mono`} />
          <span className="absolute right-4 top-1/2 -translate-y-1/2"><BrandMark brand={p.brand} /></span>
        </div>
        {err("number")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="cc-exp" className="block text-sm font-semibold">Validade</label>
          <input id="cc-exp" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={p.exp} aria-invalid={!!p.errors.exp}
            onChange={(e) => p.onExp(e.target.value)} className={`${input} font-mono`} />
          {err("exp")}
        </div>
        <div>
          <label htmlFor="cc-cvv" className="block text-sm font-semibold">CVV</label>
          <input id="cc-cvv" inputMode="numeric" autoComplete="cc-csc" placeholder="123" type="password" value={p.cvv} aria-invalid={!!p.errors.cvv}
            onChange={(e) => p.onCvv(e.target.value)} className={`${input} font-mono`} />
          {err("cvv")}
        </div>
      </div>
      <div>
        <label htmlFor="cc-name" className="block text-sm font-semibold">Nome no cartão</label>
        <input id="cc-name" autoComplete="cc-name" placeholder="ANA MACHAVA" value={p.holder} aria-invalid={!!p.errors.holder}
          onChange={(e) => p.onHolder(e.target.value)} className={`${input} uppercase`} />
        {err("holder")}
      </div>
      <p className="flex items-start gap-2 text-xs text-muted">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        O número e o CVV ficam no seu dispositivo. Só seguem a marca, os últimos 4 dígitos e um token; o seu banco pode pedir um código de confirmação (3-D Secure).
      </p>
    </div>
  );
}
