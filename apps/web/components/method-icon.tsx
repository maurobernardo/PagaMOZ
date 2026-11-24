import { CreditCard, Landmark, QrCode, Smartphone } from "lucide-react";

const ICONS = { mpesa: Smartphone, emola: Smartphone, mkesh: Smartphone, cartao: CreditCard, referencia_bancaria: Landmark, qr: QrCode };

/** Mosaico do método de pagamento (sem logótipos de marcas reais). */
export function MethodIcon({ method, className = "" }: { method: string; className?: string }) {
  const I = ICONS[method as keyof typeof ICONS] ?? CreditCard;
  return (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-canvas text-ink ${className}`} aria-hidden>
      <I className="h-5 w-5" strokeWidth={1.8} />
    </span>
  );
}
