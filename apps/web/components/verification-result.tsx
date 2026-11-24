import { Icon } from "@/components/icons";
import { Card, Row } from "@/components/ui";
import type { Schemas } from "@/lib/api";
import { formatMZN } from "@/lib/i18n";

export type Verification = Schemas["Verification"];

const LOOK = {
  valido: { title: "Comprovativo autêntico", cls: "bg-emerald-100 text-emerald-700", icon: "check" },
  anulado: { title: "Comprovativo anulado", cls: "bg-red-100 text-red-700", icon: "x" },
  em_analise: { title: "Pagamento em análise", cls: "bg-amber-100 text-amber-800", icon: "clock" },
  adulterado: { title: "Registo não confere", cls: "bg-red-100 text-red-700", icon: "x" },
} as const;

export function VerificationResult({ v }: { v: Verification }) {
  const look = LOOK[v.resultado];
  return (
    <div aria-live="polite">
      <div className="text-center">
        <span className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${look.cls}`}>
          <Icon name={look.icon} className="h-8 w-8" />
        </span>
        <h2 className="mt-3 text-2xl font-bold">{look.title}</h2>
        <p className="mt-1 text-slate-600">{v.mensagem}</p>
        {v.demonstracao ? (
          <p className="mx-auto mt-3 max-w-sm rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950">
            Emitido em ambiente de demonstração: não é um documento oficial.
          </p>
        ) : null}
      </div>
      <Card className="mt-5">
        <dl className="divide-y divide-slate-100 text-sm">
          <Row label="Código">{v.codigo}</Row>
          <Row label="Referência">{v.referencia}</Row>
          <Row label="Instituição">{v.instituicao}</Row>
          <Row label="Serviço">{v.servico}</Row>
          <Row label="Data e hora">{v.data_hora}</Row>
          <Row label="Total" strong>{formatMZN(v.total)}</Row>
        </dl>
        <p className="mt-3 break-all text-xs text-slate-500">Hash: {v.hash_conteudo}</p>
      </Card>
      <p className="mt-3 text-center text-xs text-slate-500">
        Compare estes dados com o papel ou PDF que lhe mostraram. Se forem diferentes, o documento foi alterado.
      </p>
    </div>
  );
}
