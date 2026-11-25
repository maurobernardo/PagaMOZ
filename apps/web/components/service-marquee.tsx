import { Building, Car, GraduationCap, HeartPulse, IdCard, Landmark, Phone, ShieldCheck, Tv, Zap, Droplets, Receipt } from "lucide-react";
import Link from "next/link";

const ROW_A = [
  { icon: Zap, label: "Recarga Credelec", org: "EDM", q: "Credelec" },
  { icon: Droplets, label: "Fatura de água", org: "AdRMM", q: "água" },
  { icon: Landmark, label: "Impostos (GARE)", org: "Autoridade Tributária", q: "GARE" },
  { icon: Car, label: "Multas de trânsito", org: "INATTER", q: "multas" },
  { icon: IdCard, label: "Passaporte", org: "SENAMI", q: "passaporte" },
  { icon: GraduationCap, label: "Propinas", org: "UEM", q: "propinas" },
  { icon: Receipt, label: "Fatura de electricidade", org: "EDM", q: "electricidade" },
];
const ROW_B = [
  { icon: Phone, label: "Recarga de saldo", org: "Vodacom · Movitel · Tmcel", q: "recarga" },
  { icon: Building, label: "IAV e IPRA", org: "Conselho Municipal de Maputo", q: "autárquico" },
  { icon: ShieldCheck, label: "Contribuições", org: "INSS", q: "contribuições" },
  { icon: Tv, label: "TV e internet", org: "TVCabo · DStv", q: "mensalidade" },
  { icon: HeartPulse, label: "Factura hospitalar", org: "Hospital Central de Maputo", q: "hospitalar" },
  { icon: ShieldCheck, label: "Prémio de seguro", org: "EMOSE", q: "seguro" },
  { icon: IdCard, label: "DIRE (CPLP)", org: "SENAMI", q: "DIRE" },
];

function Row({ items, reverse = false }: { items: typeof ROW_A; reverse?: boolean }) {
  const all = [...items, ...items]; // duplicado para o ciclo não ter costura
  return (
    <div className="group flex overflow-hidden">
      <ul className={`flex shrink-0 gap-3 pr-3 ${reverse ? "animate-marquee-reverse" : "animate-marquee"} group-hover:[animation-play-state:paused]`}>
        {all.map((it, i) => (
          <li key={i} aria-hidden={i >= items.length}>
            <Link href={`/servicos?q=${encodeURIComponent(it.q)}`} tabIndex={i >= items.length ? -1 : 0}
              className="flex items-center gap-3 rounded-2xl border border-line bg-white py-2.5 pl-2.5 pr-5 transition hover:border-ink hover:shadow-lg">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white"><it.icon className="h-5 w-5" strokeWidth={1.8} /></span>
              <span className="whitespace-nowrap">
                <span className="block text-sm font-bold">{it.label}</span>
                <span className="block text-xs text-muted">{it.org}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Carrossel contínuo dos serviços disponíveis (duas filas em sentidos opostos; pára ao passar o rato). */
export function ServiceMarquee() {
  return (
    <div className="space-y-3">
      <Row items={ROW_A} />
      <Row items={ROW_B} reverse />
    </div>
  );
}
