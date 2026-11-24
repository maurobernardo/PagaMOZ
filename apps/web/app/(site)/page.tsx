import { ArrowRight, Building2, Check, FileCheck2, QrCode, Search, Share2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { LogoMark } from "@/components/logo";
import { TrackForm } from "@/components/track-form";
import { Eyebrow } from "@/components/ui";
import { api } from "@/lib/api";

export const revalidate = 60;

const METHODS = ["M-Pesa", "e-Mola", "mKesh", "Visa", "Mastercard", "Referência bancária", "QR Code"];

export default async function Home() {
  const { data: categories = [] } = await api.GET("/api/catalog/categories").catch(() => ({ data: undefined }));
  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-ink pb-0 pt-28 text-white sm:pt-36">
        <Grid />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(60%_60%_at_50%_100%,rgba(224,38,47,0.22),transparent_70%)]" aria-hidden />

        <div className="relative mx-auto max-w-5xl px-5 text-center sm:px-8">
          <div className="animate-rise"><Eyebrow dark>Pagamentos de serviços em Moçambique</Eyebrow></div>
          <h1 className="mx-auto mt-8 max-w-4xl animate-rise text-[2.6rem] font-bold leading-[1.02] tracking-[-0.035em] [animation-delay:80ms] sm:text-7xl">
            Pague contas e taxas,{" "}
            <span className="bg-gradient-to-r from-white via-white/70 to-white/30 bg-clip-text text-transparent">sem ir ao balcão.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl animate-rise text-lg text-white/65 [animation-delay:160ms]">
            Água, energia, impostos, propinas e documentos num só lugar. Pague com a carteira móvel ou cartão e receba um
            comprovativo que qualquer pessoa consegue verificar.
          </p>

          <form action="/servicos" role="search" className="glass-dark mx-auto mt-10 flex max-w-xl animate-rise items-center gap-2 rounded-full p-2 [animation-delay:240ms]">
            <label htmlFor="q" className="sr-only">Pesquisar serviço</label>
            <Search className="ml-3 h-5 w-5 shrink-0 text-white/50" aria-hidden />
            <input id="q" name="q" type="search" placeholder="Fatura de água, multa, propina…"
              className="min-h-12 min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-white/40 focus:outline-none" />
            <button className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-ink transition hover:bg-white/90">
              Pesquisar
            </button>
          </form>
          <p className="mt-5 animate-rise text-sm text-white/50 [animation-delay:300ms]">
            É uma instituição?{" "}
            <Link href="/portal" className="font-semibold text-white underline-offset-4 hover:underline">Entrar no portal <ArrowRight className="inline h-3.5 w-3.5" /></Link>
          </p>
        </div>

        <div className="relative mx-auto mt-16 max-w-6xl animate-rise px-5 [animation-delay:380ms] sm:mt-20 sm:px-8">
          <DashboardPreview />
        </div>
      </section>

      {/* ---------- Métodos ---------- */}
      <section aria-label="Métodos de pagamento aceites" className="border-b border-line bg-white">
        <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-5 py-8 font-display text-lg font-bold text-ink/35 sm:px-8">
          {METHODS.map((m) => <li key={m}>{m}</li>)}
        </ul>
      </section>

      {/* ---------- Categorias ---------- */}
      <section aria-labelledby="cat-title" className="mx-auto max-w-6xl px-5 pt-24 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Catálogo</Eyebrow>
            <h2 id="cat-title" className="mt-4 text-4xl font-bold">O que quer pagar hoje?</h2>
          </div>
          <Link href="/servicos" className="inline-flex items-center gap-2 font-semibold hover:underline">Ver todos os serviços <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {categories.length === 0 ? (
          <p className="mt-10 text-muted">Serviços indisponíveis de momento. Tente mais tarde.</p>
        ) : (
          <ul className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/servicos?categoria=${c.slug}`}
                  className="group flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-ink hover:shadow-xl sm:p-6">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-canvas text-ink transition group-hover:bg-ink group-hover:text-white">
                    <CategoryIcon slug={c.slug} />
                  </span>
                  <span lang="pt" className="mt-6 hyphens-auto font-display text-base font-bold leading-snug [overflow-wrap:anywhere] sm:text-lg">{c.name}</span>
                  <span className="mt-1 text-sm text-muted">{c.service_count} serviços</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Porquê ---------- */}
      <section className="mx-auto mt-24 max-w-6xl px-5 sm:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [ShieldCheck, "O dinheiro vai directo para a instituição", "O pagamento é liquidado na conta da entidade. A plataforma confirma e regista — não fica com os fundos."],
            [QrCode, "Comprovativo que se prova sozinho", "Cada pagamento tem um código e um QR. Qualquer pessoa verifica a autenticidade em segundos."],
            [Share2, "Pague por outra pessoa", "Partilhe um link por WhatsApp. A família, mesmo no estrangeiro, paga a fatura por si."],
          ].map(([I, title, text], i) => {
            const Icon = I as typeof ShieldCheck;
            return (
              <div key={String(title)} className={`rounded-[var(--radius-card)] p-7 ${i === 0 ? "bg-ink text-white" : "border border-line bg-white"}`}>
                <Icon className={`h-7 w-7 ${i === 0 ? "text-accent" : ""}`} strokeWidth={1.8} />
                <h3 className="mt-10 text-xl font-bold">{String(title)}</h3>
                <p className={`mt-2 text-sm leading-relaxed ${i === 0 ? "text-white/65" : "text-muted"}`}>{String(text)}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- Acompanhar ---------- */}
      <section aria-labelledby="track-title" className="mx-auto mt-24 max-w-6xl px-5 sm:px-8">
        <div className="grid grid-cols-1 items-center gap-8 rounded-[2rem] border border-line bg-white p-6 sm:p-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div>
            <FileCheck2 className="h-8 w-8" strokeWidth={1.6} />
            <h2 id="track-title" className="mt-6 text-3xl font-bold">Acompanhar pagamento ou pedido</h2>
            <p className="mt-2 text-muted">Use o código que recebeu: PMZ… para pagamentos, PED… para pedidos de documentos.</p>
          </div>
          <TrackForm />
        </div>
      </section>

      {/* ---------- Instituições ---------- */}
      <section className="mx-auto mt-24 max-w-6xl px-5 sm:px-8">
        <div className="relative overflow-hidden rounded-[2rem] bg-ink p-8 text-white sm:p-14">
          <Grid small />
          <div className="relative grid grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div>
              <Building2 className="h-8 w-8 text-accent" strokeWidth={1.6} />
              <h2 className="mt-6 text-3xl font-bold sm:text-4xl">Recebe pagamentos de serviços?</h2>
              <p className="mt-3 max-w-lg text-white/65">Veja os recebimentos em tempo real, a reconciliação diária e cada lote liquidado na sua conta — num só portal.</p>
            </div>
            <ul className="space-y-3 text-sm">
              {["Liquidação directa na conta da instituição", "Reconciliação automática todas as noites", "Exportação para Excel e auditoria completa"].map((t) => (
                <li key={t} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-white text-ink"><Check className="h-3.5 w-3.5" /></span>{t}</li>
              ))}
              <li className="pt-4">
                <Link href="/portal" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-ink hover:bg-white/90">
                  Entrar no portal <ArrowRight className="h-4 w-4" />
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

/** Grelha de quadrados; algumas células acendem devagar (assinatura visual). */
function Grid({ small = false }: { small?: boolean }) {
  const cols = small ? 14 : 18;
  const rows = small ? 6 : 10;
  const lit = new Set([3, 22, 41, 47, 66, 75, 90, 104, 118, 131, 149, 157]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]">
      <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
        {Array.from({ length: cols * rows }, (_, i) => (
          <div key={i} className="border-b border-r border-white/[0.06]">
            {lit.has(i) ? <div className="h-full w-full animate-cell bg-white" style={{ animationDelay: `${(i % 7) * 0.8}s` }} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Pré-visualização estática do portal (os nossos componentes, não uma imagem). */
function DashboardPreview() {
  const bars = [38, 52, 44, 70, 58, 64, 49, 80, 66, 72, 61, 90, 76, 84];
  return (
    <div className="overflow-hidden rounded-t-[1.75rem] border border-b-0 border-white/15 bg-white/5 p-2 pb-0 shadow-[0_-20px_80px_-20px_rgba(224,38,47,0.35)] backdrop-blur">
      <div className="overflow-hidden rounded-t-[1.35rem] bg-canvas text-ink">
        <div className="flex items-center gap-2 border-b border-line bg-white px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-accent" /><span className="h-3 w-3 rounded-full bg-ink/20" /><span className="h-3 w-3 rounded-full bg-ink/20" />
          <span className="mx-auto rounded-full bg-canvas px-4 py-1 text-xs text-muted">pagamoz · portal da instituição</span>
        </div>
        <div className="grid grid-cols-[56px_1fr] sm:grid-cols-[180px_1fr]">
          <div className="hidden space-y-2 border-r border-line bg-white p-3 sm:block">
            <div className="flex items-center gap-2 pb-3"><LogoMark className="h-6 w-6" /><span className="font-display text-sm font-bold">pagamoz</span></div>
            {["Painel", "Transacções", "Liquidações", "Reconciliação", "Pedidos"].map((l, i) => (
              <div key={l} className={`rounded-xl px-3 py-2 text-left text-xs font-medium ${i === 0 ? "bg-ink text-white" : "text-muted"}`}>{l}</div>
            ))}
          </div>
          <div className="block space-y-2 border-r border-line bg-white p-2 sm:hidden">
            <LogoMark className="h-7 w-7" />
          </div>
          <div className="p-4 text-left sm:p-6">
            <p className="font-display text-xl font-bold sm:text-2xl">Bem-vindo, Inês.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-2xl bg-ink p-4 text-white">
                <p className="text-[10px] uppercase tracking-widest text-white/50">Creditado · 30 dias</p>
                <p className="mt-2 font-display text-xl font-bold">314 796,02 MT</p>
                <p className="mt-3 font-mono text-[10px] tracking-widest text-white/60">****1015 · Banco Horizonte</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-[11px] text-muted">Recebido hoje</p>
                <p className="mt-1 font-display text-lg font-bold">11 416,15 MT</p>
                <p className="text-[11px] text-muted">6 pagamentos</p>
              </div>
              <div className="hidden rounded-2xl bg-white p-4 sm:block">
                <p className="text-[11px] text-muted">Taxa de liquidação</p>
                <p className="mt-1 font-display text-lg font-bold">96,5%</p>
                <div className="mt-2 h-1.5 rounded-full bg-canvas"><div className="h-1.5 w-[96%] rounded-full bg-ink" /></div>
              </div>
            </div>
            <div className="mt-3 rounded-2xl bg-white p-4">
              <p className="text-[11px] font-semibold">Recebimentos diários</p>
              <div className="mt-3 flex h-24 items-end gap-1.5">
                {bars.map((h, i) => <div key={i} className={`flex-1 rounded-t ${i === bars.length - 1 ? "bg-accent" : "bg-ink/80"}`} style={{ height: `${h}%` }} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
