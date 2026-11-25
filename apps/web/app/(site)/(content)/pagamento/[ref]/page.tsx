"use client";

import { CheckCircle2, Clock3, Copy, Download, KeyRound, LayoutGrid, RotateCcw, ShieldCheck, UserRound, XCircle } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { MethodIcon } from "@/components/method-icon";
import { ThreeDS } from "@/components/three-ds";
import { useToast } from "@/components/toast";
import { Alert, Badge, Row, Skeleton } from "@/components/ui";
import { api, type Payment } from "@/lib/api";
import { formatDateTime, formatMZN, METHOD_LABEL, PAYMENT_STATUS } from "@/lib/i18n";

const WAITING = ["CRIADA", "PENDENTE"];

export default function PaymentStatus({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = use(params);
  const toast = useToast();
  const [p, setP] = useState<Payment | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let stop = false;
    let delay = 1500;
    let last = "";
    async function tick() {
      const r = await api.GET("/api/payments/{reference}", { params: { path: { reference: ref } } }).catch(() => null);
      if (stop) return;
      if (r?.response.status === 404) return setMissing(true);
      if (r?.data) {
        if (last && last !== r.data.status && !WAITING.includes(r.data.status)) {
          toast(r.data.status === "CONFIRMADA" ? "Pagamento confirmado." : "O pagamento não foi concluído.", r.data.status === "CONFIRMADA" ? "ok" : "bad");
        }
        last = r.data.status;
        setP(r.data);
      }
      if (!r?.data || WAITING.includes(r.data.status)) {
        delay = Math.min(delay * 1.3, 8000); // poupar dados móveis
        setTimeout(tick, delay);
      }
    }
    tick();
    return () => {
      stop = true;
    };
  }, [ref, toast]);

  if (missing) return <div className="mx-auto max-w-xl"><Alert>Não encontrámos o pagamento {ref}. Confirme o código.</Alert></div>;
  if (!p) return <div className="mx-auto max-w-xl space-y-4" role="status" aria-label="A carregar pagamento"><Skeleton className="h-48" /><Skeleton className="h-72" /></div>;

  const st = PAYMENT_STATUS[p.status] ?? { label: p.status, tone: "info" as const };
  const waiting = WAITING.includes(p.status);
  const ok = st.tone === "ok";
  const Icon = ok ? CheckCircle2 : waiting ? Clock3 : XCircle;

  return (
    <div className="mx-auto max-w-xl">
      <section aria-live="polite" className={`relative overflow-hidden rounded-[2rem] p-8 text-center ${ok ? "bg-ink text-white" : "border border-line bg-white"}`}>
        <span className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${ok ? "bg-white text-ink" : waiting ? "bg-canvas" : "bg-accent-soft text-accent"}`}>
          <Icon className={`h-8 w-8 ${waiting ? "motion-safe:animate-pulse" : ""}`} />
        </span>
        <h1 className="mt-5 text-3xl font-bold">{ok ? "Pagamento confirmado" : waiting ? "A aguardar confirmação" : st.label}</h1>
        <p className={`mx-auto mt-2 max-w-sm ${ok ? "text-white/65" : "text-muted"}`}>
          {ok ? `${p.institution_name} recebeu o seu pagamento.` : waiting && p.next_action === "3ds" ? "O seu banco pede confirmação do pagamento." : waiting ? p.instructions : p.failure_reason || "O pagamento não foi concluído. Não foi cobrado."}
        </p>
        <p className={`mt-6 font-display text-4xl font-bold tabular-nums ${ok ? "" : "text-ink"}`}>{formatMZN(p.total)}</p>
      </section>

      {waiting && p.bank ? (
        <section className="mt-6 rounded-[var(--radius-card)] border border-line bg-white p-6">
          <h2 className="flex items-center gap-2 font-bold"><MethodIcon method="referencia_bancaria" className="!h-9 !w-9" /> Dados para pagar no banco</h2>
          <p className="mt-1 text-sm text-muted">Balcão, ATM ou banca online, na opção Pagamento de serviços.</p>
          <dl className="mt-5 grid gap-2 sm:grid-cols-3">
            {[["Entidade", p.bank.entidade], ["Referência", p.bank.referencia.replace(/(\d{3})(?=\d)/g, "$1 ")], ["Montante", formatMZN(p.bank.valor)]].map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-canvas p-4">
                <dt className="text-xs text-muted">{l}</dt>
                <dd className="mt-1 flex items-center justify-between gap-2 font-mono text-lg font-bold">
                  {v}
                  <button type="button" aria-label={`Copiar ${l}`} className="frame-none rounded-lg p-1.5 hover:bg-white"
                    onClick={() => { navigator.clipboard?.writeText(String(v).replace(/\s/g, "")); toast(`${l} copiada.`, "info"); }}><Copy className="h-4 w-4" /></button>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {waiting && p.method === "qr" ? (
        <section className="mt-6 flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-line bg-white p-6 text-center sm:flex-row sm:text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/payments/${p.reference}/qr.svg`} alt={`QR do pagamento ${p.reference}`} width={180} height={180} className="rounded-2xl border border-line p-2" />
          <div>
            <h2 className="font-bold">Leia com a app do banco ou carteira</h2>
            <p className="mt-1 text-sm text-muted">O QR leva o montante de {formatMZN(p.total)} e a referência {p.reference}. Fica válido enquanto o pagamento estiver pendente.</p>
          </div>
        </section>
      ) : null}
      {p.next_action === "3ds" ? <ThreeDS p={p} onDone={(np) => { setP(np); toast("Autenticado pelo banco. A confirmar o pagamento…", "info"); }} /> : null}

      {ok && p.delivery?.codigo ? (
        <section className="mt-4 rounded-[2rem] border-2 border-ink bg-white p-6 text-center">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            <KeyRound className="h-4 w-4 text-accent" /> {p.delivery.titulo}
          </p>
          <p className="mt-3 break-all font-mono text-2xl font-bold tracking-wider sm:text-3xl">{p.delivery.codigo}</p>
          {p.delivery.instrucao ? <p className="mx-auto mt-3 max-w-sm text-sm text-muted">{p.delivery.instrucao}</p> : null}
          <div className="glass mt-5 inline-flex rounded-full p-1.5">
            <button onClick={() => navigator.clipboard?.writeText(p.delivery!.codigo!.replace(/\s/g, "")).then(() => toast("Código copiado."))}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white hover:bg-ink/85">
              <Copy className="h-4 w-4" /> Copiar código
            </button>
          </div>
        </section>
      ) : null}

      {/* Talão */}
      <section className="relative mt-4 rounded-[2rem] border border-line bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Referência</p>
            <button onClick={() => navigator.clipboard?.writeText(p.reference).then(() => toast("Referência copiada."))}
              className="mt-1 inline-flex items-center gap-2 font-mono text-lg font-bold tracking-wider hover:underline" aria-label={`Copiar referência ${p.reference}`}>
              {p.reference} <Copy className="h-4 w-4 text-muted" />
            </button>
          </div>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        <div className="my-5 border-t border-dashed border-ink/20" />
        <div className="flex items-center gap-3">
          <MethodIcon method={p.method} />
          <div>
            <p className="font-semibold">{p.service_name}</p>
            <p className="text-sm text-muted">{p.institution_name}</p>
          </div>
        </div>
        <dl className="mt-4 divide-y divide-line text-sm">
          {p.description && p.description !== p.service_name ? <Row label="Detalhe">{p.description}</Row> : null}
          <Row label="Método">{METHOD_LABEL[p.method] ?? p.method}</Row>
          <Row label="Data">{formatDateTime(p.confirmed_at ?? p.created_at)}</Row>
          <Row label="Valor">{formatMZN(p.amount)}</Row>
          {p.commission_payer === "cidadao" ? <Row label="Taxa de serviço">{formatMZN(p.commission)}</Row> : null}
          <Row label="Total pago" strong>{formatMZN(p.total)}</Row>
        </dl>
      </section>

      {ok ? (
        <section className="mt-4 rounded-[2rem] border border-line bg-white p-6">
          <div className="glass flex rounded-full p-1.5">
            {/* Link simples (não JS): abre o visualizador de PDF do telemóvel. */}
            <a href={`/api/payments/${p.reference}/receipt.pdf`} onClick={() => toast("A descarregar comprovativo…", "info")}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 font-semibold text-white hover:bg-ink/85">
              <Download className="h-5 w-5" /> Descarregar comprovativo (PDF)
            </a>
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-muted">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {p.receipt_code ? (
              <span>
                Código de verificação{" "}
                <Link href={`/verificar/${p.receipt_code.replace("-", "")}`} className="font-mono font-semibold text-ink underline">{p.receipt_code}</Link>
              </span>
            ) : (
              <span>Qualquer pessoa pode confirmar a autenticidade em <Link href="/verificar" className="font-semibold text-ink underline">/verificar</Link>.</span>
            )}
          </p>
        </section>
      ) : null}

      <div className="mt-6 flex justify-center">
        <div className="glass inline-flex flex-wrap justify-center gap-1.5 rounded-full p-1.5">
          {!waiting && !ok ? (
            <Link href={`/servicos/${p.service}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white hover:bg-ink/85">
              <RotateCcw className="h-4 w-4" /> Tentar de novo
            </Link>
          ) : null}
          <Link href="/servicos" className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold hover:bg-white">
            <LayoutGrid className="h-4 w-4" /> Pagar outro serviço
          </Link>
          <Link href="/conta" className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold hover:bg-white">
            <UserRound className="h-4 w-4" /> Os meus pagamentos
          </Link>
        </div>
      </div>
    </div>
  );
}
