import {
  ArrowRight, ArrowUpRight, BadgeCheck, Building2, Check, ChevronDown, CircleDollarSign, FileCheck2, Landmark, MousePointerClick,
  CircleAlert, HelpCircle, LayoutDashboard, LayoutGrid, ListOrdered, MapPin, QrCode, Search, Share2, ShieldCheck, Smartphone,
} from "lucide-react";
import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { LogoMark } from "@/components/logo";
import { TrackForm } from "@/components/track-form";
import { Eyebrow } from "@/components/eyebrow";
import { api } from "@/lib/api";

export const revalidate = 60;

const METHODS = ["M-Pesa", "e-Mola", "mKesh", "Visa", "Mastercard", "Referência bancária", "QR Code"];

const FAQ = [
  ["O dinheiro passa pelo PagaMOZ?", "Não. O parceiro de pagamento transfere o valor directamente para a conta da instituição. O PagaMOZ confirma, regista e emite o comprovativo."],
  ["Como sei que um comprovativo é verdadeiro?", "Cada comprovativo tem um código e um QR. Abra /verificar, escreva o código ou carregue o PDF: qualquer alteração ao ficheiro é detectada."],
  ["Posso pagar por um familiar?", "Sim. No passo do valor toque em “Pedir a alguém” e partilhe o link. Quem o abrir vê os dados preenchidos e paga com o seu próprio método."],
  ["Preciso de criar conta?", "Não para pagar. A conta serve para guardar contratos, ver o histórico e descarregar comprovativos mais tarde. Entra-se com o número de telemóvel."],
] as const;

export default async function Home() {
  const { data: categories = [] } = await api.GET("/api/catalog/categories").catch(() => ({ data: undefined }));
  const total = categories.reduce((a, c) => a + c.service_count, 0);

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative isolate overflow-hidden bg-ink pt-32 text-white sm:pt-40">
        <HeroBackdrop />
        <div className="relative mx-auto max-w-5xl px-5 text-center sm:px-8">
          <div className="animate-rise"><Eyebrow dark icon={MapPin}>Pagamentos de serviços em Moçambique</Eyebrow></div>
          <h1 className="mx-auto mt-8 max-w-4xl animate-rise text-[2.6rem] font-bold leading-[1.02] tracking-[-0.035em] [animation-delay:80ms] sm:text-7xl">
            Pague contas e taxas,{" "}
            <span className="bg-gradient-to-r from-white via-white/75 to-white/35 bg-clip-text text-transparent">sem ir ao balcão.</span>
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
            <button className="frame-none inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-white px-6 font-semibold text-ink transition hover:bg-white/90">
              Pesquisar
            </button>
          </form>
          <div className="mt-6 flex animate-rise justify-center [animation-delay:300ms]">
            <Link href="/portal" className="glass-dark inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white/80 transition hover:text-white">
              <Building2 className="h-4 w-4" /> É uma instituição? Entrar no portal <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="relative mx-auto mt-16 max-w-6xl animate-rise px-5 [animation-delay:380ms] sm:mt-20 sm:px-8">
          <DashboardPreview />
        </div>
      </section>

      {/* ---------- Métodos ---------- */}
      <section aria-label="Métodos de pagamento aceites" className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 py-9 sm:px-8 md:flex-row md:justify-between">
          <p className="shrink-0 text-sm font-semibold text-muted">Pague com</p>
          <ul className="flex flex-wrap justify-center gap-2">
            {METHODS.map((m) => (
              <li key={m} className="rounded-full border border-line bg-canvas px-4 py-2 font-display text-sm font-bold text-ink/70">{m}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- Como funciona ---------- */}
      <section aria-labelledby="how" className="mx-auto max-w-6xl px-5 pt-20 sm:px-8">
        <SectionHead icon={ListOrdered} eyebrow="Como funciona" id="how" title="Três passos. Nenhuma fila." sub="Do sofá, do trabalho ou do outro lado do mundo." />
        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            [MousePointerClick, "Escolha o serviço", "Pesquise pela instituição ou pelo que quer pagar: fatura, multa, propina, certidão."],
            [CircleDollarSign, "Confirme o valor", "Introduza o contrato ou a referência. O valor vem do sistema da instituição — não há como errar."],
            [BadgeCheck, "Pague e guarde a prova", "M-Pesa, e-Mola, mKesh, cartão ou banco. O comprovativo com QR chega na hora."],
          ].map(([I, title, text], i) => {
            const Icon = I as typeof Search;
            return (
              <li key={String(title)} className="relative rounded-[var(--radius-card)] border border-line bg-white p-7">
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-white"><Icon className="h-5 w-5" strokeWidth={1.8} /></span>
                  <span className="font-display text-5xl font-extrabold text-ink/[0.07]">0{i + 1}</span>
                </div>
                <h3 className="mt-8 text-xl font-bold">{String(title)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{String(text)}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ---------- Categorias ---------- */}
      <section aria-labelledby="cat-title" className="mx-auto max-w-6xl px-5 pt-20 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead icon={LayoutGrid} eyebrow={`Catálogo · ${total} serviços`} id="cat-title" title="O que quer pagar hoje?" />
          <div className="glass inline-flex rounded-full p-1.5">
            <Link href="/servicos" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink/85">
              Ver todos os serviços <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        {categories.length === 0 ? (
          <p className="mt-10 text-muted">Serviços indisponíveis de momento. Tente mais tarde.</p>
        ) : (
          <ul className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/servicos?categoria=${c.slug}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-ink hover:shadow-2xl sm:p-6">
                  <div className="flex items-start justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-canvas text-ink transition duration-300 group-hover:bg-ink group-hover:text-white">
                      <CategoryIcon slug={c.slug} />
                    </span>
                    <ArrowUpRight className="h-5 w-5 text-ink/20 transition group-hover:text-ink" aria-hidden />
                  </div>
                  <span lang="pt" className="mt-8 hyphens-auto font-display text-base font-bold leading-snug [overflow-wrap:anywhere] sm:text-lg">{c.name}</span>
                  <span className="mt-1 text-sm text-muted">{c.service_count} serviços</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Porquê (bento) ---------- */}
      <section aria-labelledby="why" className="mx-auto max-w-6xl px-5 pt-20 sm:px-8">
        <SectionHead icon={ShieldCheck} eyebrow="Porquê PagaMOZ" id="why" title="Feito para confiar." sub="Para quem paga e para quem recebe." />
        <div className="mt-14 grid gap-5 md:grid-cols-6">
          <article className="relative overflow-hidden rounded-[var(--radius-card)] bg-ink p-8 text-white md:col-span-4">
            <ShieldCheck className="relative h-7 w-7 text-accent" strokeWidth={1.8} />
            <h3 className="relative mt-6 max-w-md text-2xl font-bold sm:text-3xl">O dinheiro vai directo para a instituição.</h3>
            <p className="relative mt-2 max-w-md text-sm text-white/60">O PagaMOZ confirma e regista. Não fica com os fundos, nem por um dia.</p>
            <ol className="relative mt-10 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center text-xs font-semibold sm:text-sm">
              <FlowNode icon={<Smartphone className="h-5 w-5" />} label="Cidadão" />
              <FlowArrow />
              <FlowNode icon={<Landmark className="h-5 w-5" />} label="Parceiro licenciado" />
              <FlowArrow />
              <FlowNode icon={<Building2 className="h-5 w-5" />} label="Conta da instituição" accent />
            </ol>
          </article>

          <article className="rounded-[var(--radius-card)] border border-line bg-white p-8 md:col-span-2">
            <QrCode className="h-7 w-7" strokeWidth={1.8} />
            <h3 className="mt-6 text-xl font-bold">Comprovativo que se prova sozinho.</h3>
            <div className="mt-6 rounded-2xl border border-dashed border-ink/20 bg-canvas p-4 font-mono text-xs">
              <div className="flex items-center justify-between"><LogoMark className="h-6 w-6" /><span className="font-bold">PAGO</span></div>
              <p className="mt-4 text-muted">Código</p>
              <p className="text-base font-bold tracking-widest">7KQ2M-XH4RT</p>
              <p className="mt-3 flex items-center gap-1.5 font-sans font-semibold"><BadgeCheck className="h-4 w-4" /> Autêntico</p>
            </div>
          </article>

          <article className="rounded-[var(--radius-card)] border border-line bg-white p-8 md:col-span-3">
            <Share2 className="h-7 w-7" strokeWidth={1.8} />
            <h3 className="mt-6 text-xl font-bold">Pague por outra pessoa.</h3>
            <p className="mt-2 text-sm text-muted">Um link por mensagem e a família, mesmo no estrangeiro, paga a fatura por si.</p>
            <div className="mt-6 space-y-2 text-sm">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-white">Mana, consegues pagar a água deste mês?</p>
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-canvas px-4 py-2.5 font-medium">pagamoz · Fatura de água — 1 250,00 MT</p>
              <p className="w-fit rounded-2xl rounded-bl-md border border-line px-4 py-2.5">Feito. Já tens o comprovativo.</p>
            </div>
          </article>

          <article className="rounded-[var(--radius-card)] border border-line bg-white p-8 md:col-span-3">
            <Smartphone className="h-7 w-7" strokeWidth={1.8} />
            <h3 className="mt-6 text-xl font-bold">Leve no telemóvel, leve nos dados.</h3>
            <p className="mt-2 text-sm text-muted">Páginas pequenas, pensadas para rede móvel. O estado do pagamento actualiza-se sozinho, sem recarregar.</p>
            <ul className="mt-6 grid grid-cols-3 gap-2 text-center">
              {[["3", "passos"], ["6", "métodos"], ["0", "filas"]].map(([n, l]) => (
                <li key={l} className="rounded-2xl bg-canvas px-2 py-4">
                  <p className="font-display text-2xl font-bold">{n}</p>
                  <p className="text-xs text-muted">{l}</p>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      {/* ---------- Acompanhar ---------- */}
      <section aria-labelledby="track-title" className="mx-auto max-w-6xl px-5 pt-20 sm:px-8">
        <div className="grid grid-cols-1 items-center gap-10 rounded-[2rem] border border-line bg-white p-6 sm:p-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-canvas"><FileCheck2 className="h-5 w-5" /></span>
            <h2 id="track-title" className="mt-6 text-3xl font-bold">Acompanhar pagamento ou pedido</h2>
            <p className="mt-2 text-muted">Use o código que recebeu: PMZ… para pagamentos, PED… para pedidos de documentos.</p>
          </div>
          <TrackForm />
        </div>
      </section>

      {/* ---------- Perguntas ---------- */}
      <section aria-labelledby="faq" className="mx-auto grid max-w-6xl gap-10 px-5 pt-20 sm:px-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <SectionHead icon={HelpCircle} eyebrow="Perguntas" id="faq" title="O que as pessoas perguntam." />
        <div className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {q}
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-canvas transition group-open:rotate-180 group-open:bg-ink group-open:text-white">
                  <ChevronDown className="h-4 w-4" />
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------- Instituições ---------- */}
      <section className="mx-auto max-w-6xl px-5 pt-20 sm:px-8">
        <div className="relative overflow-hidden rounded-[2rem] bg-ink p-8 text-white sm:p-14">
          <div className="relative grid grid-cols-1 items-center gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div>
              <Eyebrow dark icon={Building2}>Para instituições</Eyebrow>
              <h2 className="mt-6 text-3xl font-bold sm:text-4xl">Recebe pagamentos de serviços?</h2>
              <p className="mt-3 max-w-lg text-white/65">Veja os recebimentos em tempo real, a reconciliação diária e cada lote liquidado na sua conta — num só portal.</p>
              <ul className="mt-8 space-y-3 text-sm">
                {["Liquidação directa na conta da instituição", "Reconciliação automática todas as noites", "Exportação para Excel e auditoria completa"].map((t) => (
                  <li key={t} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-white text-ink"><Check className="h-3.5 w-3.5" /></span>{t}</li>
                ))}
              </ul>
              <div className="glass-dark mt-10 inline-flex rounded-full p-2">
                <Link href="/portal" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-ink hover:bg-white/90">
                  Entrar no portal <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="glass-dark rounded-3xl p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-white/50">Liquidado na conta · 30 dias</p>
              <p className="mt-2 font-display text-3xl font-bold">314 796,02 MT</p>
              <div className="mt-6 space-y-3">
                {[["Fatura de água", "98%"], ["Taxa de circulação", "76%"], ["Propinas", "61%"]].map(([l, w]) => (
                  <div key={l}>
                    <div className="flex justify-between text-xs text-white/60"><span>{l}</span><span>{w}</span></div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/10"><div className="h-1.5 rounded-full bg-white" style={{ width: w }} /></div>
                  </div>
                ))}
              </div>
              <p className="mt-6 rounded-2xl bg-white/5 px-4 py-3 text-xs text-white/60">
                <CircleAlert className="mr-2 inline h-3.5 w-3.5 -translate-y-px text-accent" />1 divergência por rever na reconciliação de ontem
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHead({ eyebrow, title, sub, id, icon }: { eyebrow: string; title: string; sub?: string; id: string; icon?: typeof Search }) {
  return (
    <div>
      <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
      <h2 id={id} className="mt-5 max-w-xl text-4xl font-bold leading-[1.05] sm:text-5xl">{title}</h2>
      {sub ? <p className="mt-3 text-muted">{sub}</p> : null}
    </div>
  );
}

function FlowNode({ icon, label, accent }: { icon: React.ReactNode; label: string; accent?: boolean }) {
  return (
    <li className="flex flex-col items-center gap-2">
      <span className={`grid h-12 w-12 place-items-center rounded-2xl ${accent ? "bg-white text-ink" : "glass-dark"}`}>{icon}</span>
      <span className="text-white/75">{label}</span>
    </li>
  );
}

function FlowArrow() {
  return <li aria-hidden className="mb-6 flex items-center text-white/40"><ArrowRight className="h-4 w-4" /></li>;
}

/**
 * Fundo do hero: grelha de linhas finas. Algumas células acendem devagar, sempre nas colunas das margens
 * (nunca atrás do título). Uma luz suave de cima e um brilho vermelho discreto em baixo.
 */
function HeroBackdrop() {
  const cols = 16;
  const rows = 9;
  const lit = [[0, 1], [1, 4], [0, 6], [2, 2], [14, 1], [15, 3], [13, 5], [15, 7], [1, 8], [14, 8]];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 grid [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
        {Array.from({ length: cols * rows }, (_, k) => {
          const c = k % cols, r = Math.floor(k / cols);
          const on = lit.findIndex(([x, y]) => x === c && y === r);
          return (
            <div key={k} className="border-b border-r border-white/[0.06]">
              {on >= 0 ? <div className="h-full w-full animate-cell bg-white" style={{ animationDelay: `${on * 0.9}s` }} /> : null}
            </div>
          );
        })}
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(45%_45%_at_50%_30%,rgba(11,11,12,0.95),transparent_75%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,rgba(255,255,255,0.10),transparent_70%)]" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(55%_55%_at_50%_100%,rgba(224,38,47,0.22),transparent_70%)]" />
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
          <LayoutDashboard className="h-4 w-4 text-muted" />
          <span className="mx-auto rounded-full bg-canvas px-4 py-1 text-xs text-muted">pagamoz · portal da instituição</span>
        </div>
        <div className="grid grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[180px_minmax(0,1fr)]">
          <div className="hidden space-y-2 border-r border-line bg-white p-3 sm:block">
            <div className="flex items-center gap-2 pb-3"><LogoMark className="h-6 w-6" /><span className="font-display text-sm font-bold">pagamoz</span></div>
            {["Painel", "Transacções", "Liquidações", "Reconciliação", "Pedidos"].map((l, i) => (
              <div key={l} className={`rounded-xl px-3 py-2 text-left text-xs font-medium ${i === 0 ? "bg-ink text-white" : "text-muted"}`}>{l}</div>
            ))}
          </div>
          <div className="block space-y-2 border-r border-line bg-white p-2 sm:hidden"><LogoMark className="h-7 w-7" /></div>
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
