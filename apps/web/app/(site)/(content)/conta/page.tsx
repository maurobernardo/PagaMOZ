"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Button, ButtonLink, Card, PageTitle } from "@/components/ui";
import { api, type Payment, type Schemas, type ServiceRequest } from "@/lib/api";
import { formatDateTime, formatMZN, PAYMENT_STATUS, REQUEST_STATUS } from "@/lib/i18n";

type Obligation = Schemas["Obligation"];

export default function Conta() {
  const router = useRouter();
  const [me, setMe] = useState<Schemas["Me"] | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [wallet, setWallet] = useState<Obligation[]>([]);

  useEffect(() => {
    api.GET("/api/me").then((r) => {
      if (r.response.status === 403 || r.response.status === 401) return router.replace("/entrar?next=/conta");
      if (r.data) setMe(r.data);
    });
    api.GET("/api/me/payments").then((r) => r.data && setPayments(r.data.results));
    api.GET("/api/me/requests").then((r) => r.data && setRequests(r.data.results));
    api.GET("/api/me/obligations").then((r) => r.data && setWallet(r.data));
  }, [router]);

  async function remove(id: number) {
    await api.DELETE("/api/me/obligations/{id}", { params: { path: { id } } });
    setWallet((w) => w.filter((o) => o.id !== id));
  }

  async function logout() {
    await api.POST("/api/auth/logout");
    router.replace("/");
    router.refresh();
  }

  if (!me) return <p role="status" className="text-muted">A carregar…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <PageTitle sub={me.phone}>A minha conta</PageTitle>
        <Button variant="secondary" onClick={logout}>Sair</Button>
      </div>

      <section aria-labelledby="w">
        <h2 id="w" className="text-lg font-bold">Carteira de obrigações</h2>
        <p className="text-sm text-muted">Contratos e referências que paga com frequência.</p>
        {wallet.length === 0 ? (
          <Empty>Ainda não guardou nenhuma. No passo “Valor” de um pagamento, toque em “Guardar”.</Empty>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {wallet.map((o) => (
              <li key={o.id}>
                <Card className="flex h-full flex-col gap-2 p-4">
                  <p className="font-semibold">{o.label}</p>
                  <p className="text-sm text-muted">
                    {o.service_detail.institution.name} · {Object.values(o.fields as Record<string, string>).join(" · ")}
                  </p>
                  <div className="mt-auto flex gap-2">
                    <ButtonLink href={`/servicos/${o.service}?${new URLSearchParams(o.fields as Record<string, string>)}`} className="flex-1">
                      Pagar
                    </ButtonLink>
                    <Button variant="secondary" onClick={() => remove(o.id)} aria-label={`Remover ${o.label}`}>Remover</Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="r">
        <h2 id="r" className="text-lg font-bold">Pedidos</h2>
        {requests.length === 0 ? (
          <Empty>Sem pedidos de documentos ou licenças.</Empty>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {requests.map((r) => (
              <li key={r.code}>
                <Link href={`/pedido/${r.code}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-canvas">
                  <span>
                    <span className="block font-medium">{r.service_name}</span>
                    <span className="text-sm text-muted">{r.code} · {formatDateTime(r.created_at)}</span>
                  </span>
                  <Badge tone={r.status === "REJEITADO" ? "bad" : r.status === "CONCLUIDO" ? "ok" : "info"}>
                    {REQUEST_STATUS[r.status]}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="h">
        <h2 id="h" className="text-lg font-bold">Histórico de pagamentos</h2>
        {payments.length === 0 ? (
          <Empty>
            Ainda não fez pagamentos. <Link href="/servicos" className="font-semibold text-brand-800 underline">Ver serviços</Link>
          </Empty>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {payments.map((p) => {
              const st = PAYMENT_STATUS[p.status];
              return (
                <li key={p.reference}>
                  <Link href={`/pagamento/${p.reference}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-canvas">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.service_name}</span>
                      <span className="text-sm text-muted">{p.institution_name} · {formatDateTime(p.created_at)}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold tabular-nums">{formatMZN(p.total)}</span>
                      <Badge tone={st?.tone ?? "info"}>{st?.label ?? p.status}</Badge>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 rounded-2xl border border-dashed border-line bg-white p-5 text-sm text-muted">{children}</p>;
}
