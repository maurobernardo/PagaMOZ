"use client";

import { ArrowUpRight, Bookmark, FileText, LayoutGrid, LogOut, Pencil, ReceiptText, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProfileForm } from "@/components/profile-form";
import { CategoryIcon } from "@/components/category-icon";
import { MethodIcon } from "@/components/method-icon";
import { useToast } from "@/components/toast";
import { Badge, Empty, Skeleton, useDialog } from "@/components/ui";
import { api, type Payment, type Schemas, type ServiceRequest } from "@/lib/api";
import { formatDateTime, formatMZN, PAYMENT_STATUS, REQUEST_STATUS } from "@/lib/i18n";

type Obligation = Schemas["Obligation"];
const PAID = ["CONFIRMADA", "LIQUIDADA"];

export default function Conta() {
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();
  const [me, setMe] = useState<Schemas["Me"] | null>(null);
  const [editing, setEditing] = useState(false);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[] | null>(null);
  const [wallet, setWallet] = useState<Obligation[] | null>(null);

  useEffect(() => {
    api.GET("/api/me").then((r) => {
      if (r.response.status === 403 || r.response.status === 401) return router.replace("/entrar?next=/conta");
      if (r.data) setMe(r.data);
    });
    api.GET("/api/me/payments").then((r) => setPayments(r.data?.results ?? []));
    api.GET("/api/me/requests").then((r) => setRequests(r.data?.results ?? []));
    api.GET("/api/me/obligations").then((r) => setWallet(r.data ?? []));
  }, [router]);

  async function remove(o: Obligation) {
    if (!(await dialog.confirm({ title: `Remover “${o.label}”?`, body: "Sai da sua carteira. Pode voltar a guardá-lo no próximo pagamento.", confirm: "Remover", danger: true }))) return;
    const r = await api.DELETE("/api/me/obligations/{id}", { params: { path: { id: o.id } } });
    if (r.response.ok) {
      setWallet((w) => (w ?? []).filter((x) => x.id !== o.id));
      toast(`“${o.label}” removido da carteira.`);
    } else toast("Não foi possível remover. Tente de novo.", "bad");
  }

  async function logout() {
    await api.POST("/api/auth/logout");
    toast("Sessão terminada.", "info");
    router.replace("/");
    router.refresh();
  }

  if (!me) return <div className="space-y-4" role="status" aria-label="A carregar"><Skeleton className="h-44" /><Skeleton className="h-64" /></div>;

  const paid = (payments ?? []).filter((p) => PAID.includes(p.status));
  const totalPaid = paid.reduce((a, p) => a + p.total, 0);
  const initials = (me.name || "").split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

  return (
    <div className="space-y-6">
      {dialog.ui}
      {editing ? (
        <section className="rounded-[var(--radius-card)] border border-line bg-white p-6 sm:p-8">
          <h2 className="mb-5 text-xl font-bold">Os seus dados</h2>
          <ProfileForm initial={me as never} onSaved={() => { setEditing(false); api.GET("/api/me").then((r) => r.data && setMe(r.data)); }} />
        </section>
      ) : null}
      {/* Cabeçalho */}
      <section className="rounded-[2rem] bg-ink p-7 text-white sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-white font-display text-lg font-bold text-ink">{initials || <Wallet className="h-6 w-6" />}</span>
            <div>
              <h1 className="text-3xl font-bold">A minha conta</h1>
              <p className="text-white/60">{me.name ? `${me.name} · ` : ""}{me.phone}{me.district ? ` · ${me.district}, ${me.province}` : ""}</p>
            </div>
          </div>
          <div className="glass-dark inline-flex rounded-full p-1.5">
            <Link href="/servicos" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink hover:bg-white/90">
              <LayoutGrid className="h-4 w-4" /> Pagar serviço
            </Link>
            <button onClick={() => setEditing(!editing)} className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white">
              <Pencil className="h-4 w-4" /> Editar dados
            </button>
            <button onClick={logout} className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
        <dl className="mt-8 grid grid-cols-3 gap-2">
          {[["Total pago", formatMZN(totalPaid)], ["Pagamentos", String(paid.length)], ["Pedidos", String(requests?.length ?? 0)]].map(([l, v]) => (
            <div key={l} className="glass-dark rounded-2xl px-4 py-3">
              <dt className="text-xs text-white/50">{l}</dt>
              <dd className="mt-1 truncate font-display text-lg font-bold tabular-nums sm:text-2xl">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Carteira */}
      <section aria-labelledby="w" className="rounded-[2rem] border border-line bg-white p-6 sm:p-8">
        <Head id="w" icon={<Bookmark className="h-5 w-5" />} title="Carteira de obrigações" sub="Contratos e referências que paga com frequência." />
        {!wallet ? <Skeleton className="mt-6 h-28" /> : wallet.length === 0 ? (
          <div className="mt-6"><Empty icon={<Bookmark className="h-5 w-5" />} title="A carteira está vazia.">No passo “Valor” de um pagamento, toque em “Guardar”.</Empty></div>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {wallet.map((o) => (
              <li key={o.id} className="flex flex-col rounded-3xl border border-line bg-canvas/50 p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-white"><CategoryIcon slug={o.service_detail.category} /></span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{o.label}</p>
                    <p className="truncate text-sm text-muted">{o.service_detail.institution.name}</p>
                    <p className="mt-1 font-mono text-sm">{Object.values(o.fields as Record<string, string>).join(" · ")}</p>
                  </div>
                </div>
                <div className="glass mt-5 flex gap-1.5 rounded-full p-1.5">
                  <Link href={`/servicos/${o.service}?${new URLSearchParams(o.fields as Record<string, string>)}`}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-white hover:bg-ink/85">
                    <Wallet className="h-4 w-4" /> Pagar
                  </Link>
                  <button onClick={() => remove(o)} aria-label={`Remover ${o.label}`}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-accent hover:bg-accent-soft">
                    <Trash2 className="h-4 w-4" /> Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pedidos */}
      <section aria-labelledby="r" className="rounded-[2rem] border border-line bg-white p-6 sm:p-8">
        <Head id="r" icon={<FileText className="h-5 w-5" />} title="Pedidos" sub="Documentos e licenças em tratamento." />
        {!requests ? <Skeleton className="mt-6 h-20" /> : requests.length === 0 ? (
          <div className="mt-6"><Empty icon={<FileText className="h-5 w-5" />} title="Sem pedidos.">Pedidos de certidões, licenças e outros documentos aparecem aqui.</Empty></div>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {requests.map((r) => (
              <li key={r.code}>
                <Link href={`/pedido/${r.code}`} className="group flex items-center gap-4 rounded-2xl px-2 py-3.5 hover:bg-canvas">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-canvas"><FileText className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.service_name}</span>
                    <span className="font-mono text-xs text-muted">{r.code} · {formatDateTime(r.created_at)}</span>
                  </span>
                  <Badge tone={r.status === "REJEITADO" ? "bad" : r.status === "CONCLUIDO" ? "ok" : "info"}>{REQUEST_STATUS[r.status]}</Badge>
                  <ArrowUpRight className="hidden h-4 w-4 text-muted group-hover:text-ink sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Histórico */}
      <section aria-labelledby="h" className="rounded-[2rem] border border-line bg-white p-6 sm:p-8">
        <Head id="h" icon={<ReceiptText className="h-5 w-5" />} title="Histórico de pagamentos" sub="Toque num pagamento para ver o comprovativo." />
        {!payments ? <Skeleton className="mt-6 h-40" /> : payments.length === 0 ? (
          <div className="mt-6"><Empty icon={<ReceiptText className="h-5 w-5" />} title="Ainda não fez pagamentos.">
            <Link href="/servicos" className="font-semibold text-ink underline">Ver serviços</Link>
          </Empty></div>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {payments.map((p) => {
              const st = PAYMENT_STATUS[p.status];
              return (
                <li key={p.reference}>
                  <Link href={`/pagamento/${p.reference}`} className="flex items-center gap-4 rounded-2xl px-2 py-3.5 hover:bg-canvas">
                    <MethodIcon method={p.method} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p.service_name}</span>
                      <span className="block truncate text-sm text-muted">{p.institution_name} · {formatDateTime(p.created_at)}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-display font-bold tabular-nums">{formatMZN(p.total)}</span>
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

function Head({ id, icon, title, sub }: { id: string; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-canvas">{icon}</span>
      <div>
        <h2 id={id} className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-muted">{sub}</p>
      </div>
    </div>
  );
}
