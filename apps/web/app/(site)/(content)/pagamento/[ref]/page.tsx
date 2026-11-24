"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Alert, Badge, ButtonLink, Card, Row } from "@/components/ui";
import { api, type Payment } from "@/lib/api";
import { formatDateTime, formatMZN, METHOD_LABEL, PAYMENT_STATUS } from "@/lib/i18n";

const WAITING = ["CRIADA", "PENDENTE"];

export default function PaymentStatus({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = use(params);
  const [p, setP] = useState<Payment | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let stop = false;
    let delay = 1500;
    async function tick() {
      const r = await api.GET("/api/payments/{reference}", { params: { path: { reference: ref } } }).catch(() => null);
      if (stop) return;
      if (r?.response.status === 404) return setMissing(true);
      if (r?.data) setP(r.data);
      if (!r?.data || WAITING.includes(r.data.status)) {
        delay = Math.min(delay * 1.3, 8000); // poupar dados móveis
        setTimeout(tick, delay);
      }
    }
    tick();
    return () => {
      stop = true;
    };
  }, [ref]);

  if (missing)
    return (
      <div className="mx-auto max-w-xl">
        <Alert>Não encontrámos o pagamento {ref}. Confirme o código.</Alert>
      </div>
    );
  if (!p)
    return (
      <p role="status" className="mx-auto max-w-xl text-muted">
        A carregar pagamento…
      </p>
    );

  const st = PAYMENT_STATUS[p.status] ?? { label: p.status, tone: "info" as const };
  const waiting = WAITING.includes(p.status);
  const ok = st.tone === "ok";

  return (
    <div className="mx-auto max-w-xl">
      <div aria-live="polite" className="text-center">
        <span className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${ok ? "bg-ink text-white" : waiting ? "bg-white text-ink" : "bg-accent-soft text-accent"}`}>
          <Icon name={ok ? "check" : waiting ? "clock" : "x"} className={`h-8 w-8 ${waiting ? "motion-safe:animate-pulse" : ""}`} />
        </span>
        <h1 className="mt-3 text-2xl font-bold">
          {ok ? "Pagamento confirmado" : waiting ? "A aguardar confirmação" : st.label}
        </h1>
        <p className="mt-1 text-muted">
          {ok ? `${p.institution_name} recebeu o seu pagamento.` : waiting ? p.instructions : p.failure_reason || "O pagamento não foi concluído. Não foi cobrado."}
        </p>
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Referência</p>
            <p className="font-mono text-lg font-bold tracking-wider">{p.reference}</p>
          </div>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        <dl className="mt-4 divide-y divide-line text-sm">
          <Row label="Serviço">{p.service_name}</Row>
          <Row label="Instituição">{p.institution_name}</Row>
          {p.description && p.description !== p.service_name ? <Row label="Detalhe">{p.description}</Row> : null}
          <Row label="Método">{METHOD_LABEL[p.method] ?? p.method}</Row>
          <Row label="Data">{formatDateTime(p.confirmed_at ?? p.created_at)}</Row>
          <Row label="Valor">{formatMZN(p.amount)}</Row>
          {p.commission_payer === "cidadao" ? <Row label="Taxa de serviço">{formatMZN(p.commission)}</Row> : null}
          <Row label="Total pago" strong>{formatMZN(p.total)}</Row>
        </dl>
      </Card>

      {ok ? (
        <div className="mt-4 grid gap-2">
          {/* Link simples (não JS): funciona em qualquer browser e abre o visualizador de PDF do telemóvel. */}
          <a
            href={`/api/payments/${p.reference}/receipt.pdf`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800"
          >
            <Icon name="arrow" className="h-5 w-5 rotate-90" />
            Descarregar comprovativo (PDF)
          </a>
          <p className="text-center text-sm text-muted">
            {p.receipt_code ? (
              <>
                Código de verificação{" "}
                <Link href={`/verificar/${p.receipt_code.replace("-", "")}`} className="font-mono font-semibold text-brand-800 underline">
                  {p.receipt_code}
                </Link>
                . Qualquer pessoa pode confirmar a autenticidade.
              </>
            ) : (
              <>
                Qualquer pessoa pode confirmar a autenticidade em{" "}
                <Link href="/verificar" className="font-semibold text-brand-800 underline">/verificar</Link>.
              </>
            )}
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {!waiting && !ok ? <ButtonLink href={`/servicos/${p.service}`}>Tentar de novo</ButtonLink> : null}
        <ButtonLink href="/servicos" variant={!waiting && !ok ? "secondary" : "primary"}>Pagar outro serviço</ButtonLink>
        <ButtonLink href="/conta" variant="secondary">Os meus pagamentos</ButtonLink>
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        <Link href="/" className="hover:underline">Início</Link>
      </p>
    </div>
  );
}
