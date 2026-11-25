import { CreditCard, Landmark, QrCode, Smartphone, SmartphoneNfc, Wallet } from "lucide-react";

const ICONS = { mpesa: Smartphone, emola: SmartphoneNfc, mkesh: Wallet, cartao: CreditCard, referencia_bancaria: Landmark, qr: QrCode };

/** Prefixos de cada operadora: Vodacom 84/85, Movitel 86/87, Tmcel 82/83. */
export const WALLET_PREFIXES: Record<string, string[]> = { mpesa: ["84", "85"], emola: ["86", "87"], mkesh: ["82", "83"] };

export const METHOD_ICON = ICONS as Record<string, typeof CreditCard>;

/** Mosaico do método de pagamento (sem logótipos de marcas reais). */
export function MethodIcon({ method, className = "" }: { method: string; className?: string }) {
  const I = ICONS[method as keyof typeof ICONS] ?? CreditCard;
  return (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-canvas text-ink ${className}`} aria-hidden>
      <I className="h-5 w-5" strokeWidth={1.8} />
    </span>
  );
}
