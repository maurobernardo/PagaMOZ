import { Building, Car, GraduationCap, HeartPulse, IdCard, Landmark, LayoutGrid, Zap } from "lucide-react";

const ICONS = {
  documentos: IdCard,
  transportes: Car,
  "servicos-basicos": Zap,
  impostos: Landmark,
  educacao: GraduationCap,
  saude: HeartPulse,
  municipios: Building,
  outros: LayoutGrid,
};

export function CategoryIcon({ slug, className = "h-5 w-5" }: { slug: string; className?: string }) {
  const I = ICONS[slug as keyof typeof ICONS] ?? LayoutGrid;
  return <I className={className} strokeWidth={1.8} aria-hidden />;
}
