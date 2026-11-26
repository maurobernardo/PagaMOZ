import { BrandMark } from "./brand-mark";
import { CreditCard, Landmark, QrCode, Smartphone, SmartphoneNfc, Wallet } from "lucide-react";

const ICONS = { mpesa: Smartphone, emola: SmartphoneNfc, mkesh: Wallet, cartao: CreditCard, referencia_bancaria: Landmark, qr: QrCode };

/** Prefixos de cada operadora: Vodacom 84/85, Movitel 86/87, Tmcel 82/83. */
export const WALLET_PREFIXES: Record<string, string[]> = { mpesa: ["84", "85"], emola: ["86", "87"], mkesh: ["82", "83"] };

export const METHOD_ICON = ICONS as Record<string, typeof CreditCard>;

const LOGO: Record<string, [string, string]> = { mpesa: ["mpesa", "M-Pesa"], emola: ["emola", "e-Mola"], mkesh: ["mkesh", "mKesh"], cartao: ["visa", "Visa"] };

/** Método de pagamento: logótipo da carteira/cartão; ícone para banco e QR. */
export function MethodIcon({ method, className = "" }: { method: string; className?: string }) {
  const logo = LOGO[method];
  if (logo) return <BrandMark slug={logo[0]} name={logo[1]} size={/h-9/.test(className) ? 36 : /h-8/.test(className) ? 32 : 44} className={`border border-line ${className}`} />;
  const I = ICONS[method as keyof typeof ICONS] ?? CreditCard;
  return (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-canvas text-ink ${className}`} aria-hidden>
      <I className="h-5 w-5" strokeWidth={1.8} />
    </span>
  );
}
