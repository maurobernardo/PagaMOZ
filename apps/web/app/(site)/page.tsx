import {
  ArrowRight, BadgeCheck, Building2, Check, ChevronDown, CircleDollarSign, FileCheck2, HelpCircle, Landmark,
  LayoutGrid, ListOrdered, MapPin, MessageCircleQuestion, MousePointerClick, QrCode, Search, Share2, ShieldCheck, Smartphone,
} from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { CategoryIcon } from "@/components/category-icon";
import { Eyebrow } from "@/components/eyebrow";
import { HeroPreview } from "@/components/hero-preview";
import { LogoMark } from "@/components/logo";
import { ServiceMarquee } from "@/components/service-marquee";
import { TrackForm } from "@/components/track-form";
import { api } from "@/lib/api";

export const revalidate = 60;

const FAQ = [
  { icon: Landmark, q: "O dinheiro passa pelo PagaMOZ?", a: "Não. O parceiro de pagamento transfere o valor directamente para a conta da instituição. O PagaMOZ confirma, regista e emite o comprovativo." },
  { icon: QrCode, q: "Como sei que um comprovativo é verdadeiro?", a: "Cada comprovativo tem um código e um QR. Abra Verificar comprovativo, escreva o código ou carregue o PDF: qualquer alteração ao ficheiro é detectada." },
  { icon: Share2, q: "Posso pagar por um familiar?", a: "Sim. No passo do valor toque em Pedir a alguém e partilhe o link. Quem o abrir vê os dados preenchidos e paga com o seu próprio método." },
  { icon: Smartphone, q: "Preciso de criar conta?", a: "Não para pagar. A conta serve para guardar contratos, ver o histórico e descarregar comprovativos mais tarde. Entra-se com o número de telemóvel." },
  { icon: ShieldCheck, q: "Os dados do meu cartão ficam guardados?", a: "Não. O número e o CVV ficam no seu dispositivo; seguem apenas a marca, os últimos 4 dígitos e um token. O seu banco pode pedir um código 3-D Secure." },
  { icon: BadgeCheck, q: "E se o pagamento falhar?", a: "Não é cobrado. A página mostra o motivo e permite tentar de novo; o histórico guarda cada tentativa com o respectivo estado." },
] as const;

export default async function Home() {
  const { data: categories = [] } = await api.GET("/api/catalog/categories").catch(() => ({ data: undefined }));
  const total = categories.reduce((a, c) => a + c.service_count, 0);

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="theme-flip relative isolate overflow-hidden bg-ink pt-24 text-white sm:pt-28">
        <HeroBackdrop />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="text-center lg:text-left">
          <div className="animate-rise"><Eyebrow dark icon={MapPin}>Pagamentos de serviços em Moçambique</Eyebrow></div>
          <h1 className="mx-auto mt-6 max-w-4xl animate-rise text-[2.6rem] lg:mx-0 font-bold leading-[1.02] tracking-[-0.035em] [animation-delay:80ms] sm:text-7xl lg:text-[4.2rem]">
            Pague contas e taxas,{" "}
            <span className="bg-gradient-to-r from-white via-white/75 to-white/35 bg-clip-text text-transparent">sem ir ao balcão.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl animate-rise text-lg lg:mx-0 text-white/65 [animation-delay:160ms]">
            EDM, águas, Autoridade Tributária, INATTER, SENAMI, propinas e mais, num só lugar. Pague com M-Pesa, e-Mola,
            mKesh ou cartão e receba um comprovativo que qualquer pessoa consegue verificar.
          </p>

          <form action="/servicos" role="search" className="glass-dark mx-auto mt-10 flex max-w-xl lg:mx-0 animate-rise items-center gap-2 rounded-full p-2 [animation-delay:240ms]">
            <label htmlFor="q" className="sr-only">Pesquisar serviço</label>
            <Search className="ml-3 h-5 w-5 shrink-0 text-white/50" aria-hidden />
            <input id="q" name="q" type="search" placeholder="Credelec, fatura de água, multa, propina…"
              className="min-h-12 min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-white/40 focus:outline-none" />
            <button className="frame-none inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-white px-6 font-semibold text-ink transition hover:bg-white/90">
              Pesquisar
            </button>
          </form>

          <div className="mt-6 flex animate-rise flex-wrap justify-center gap-2 lg:justify-start [animation-delay:300ms]">
            {[["Credelec", "Credelec"], ["Água", "água"], ["Multas", "multas"], ["Passaporte", "passaporte"]].map(([l, q]) => (
              <Link key={q} href={`/servicos?q=${encodeURIComponent(q)}`} className="glass-dark inline-flex min-h-9 items-center rounded-full px-4 text-sm font-semibold text-white/75 transition hover:text-white">
                {l}
              </Link>
            ))}
            <Link href="/portal" className="glass-dark inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white/75 transition hover:text-white">
              <Building2 className="h-4 w-4" /> Sou instituição <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul aria-label="Algumas instituições" className="mt-10 flex animate-rise flex-wrap items-center justify-center gap-3 lg:justify-start [animation-delay:340ms]">
            {[["edm", "EDM"], ["fipag", "FIPAG"], ["adrmm", "AdRMM"], ["vodacom", "Vodacom"], ["movitel", "Movitel"], ["dstv", "DStv"], ["startimes", "StarTimes"], ["at", "AT"], ["inss", "INSS"], ["uem", "UEM"], ["ucm", "UCM"], ["isutc", "ISUTC"]].map(([slug, name]) => (
              <li key={slug} title={name}><BrandMark slug={slug} name={name} size={44} className="!rounded-full ring-2 ring-white/15" /></li>
            ))}
          </ul>

          </div>
          {/* A app real, em telemóvel 3D */}
          <img src="/mockup-3d.webp" alt="Ecrã de início da app PagaMOZ" width={900} height={1393}
            className="mx-auto w-[260px] animate-rise drop-shadow-[0_40px_60px_rgba(0,0,0,0.6)] [animation-delay:200ms] sm:w-[320px] lg:w-full lg:max-w-[400px]" />
        </div>

        <div className="relative mx-auto mt-14 max-w-6xl animate-rise px-5 [animation-delay:380ms] sm:mt-16 sm:px-8">
          <HeroPreview />
        </div>
      </section>

      {/* ---------- Serviços em carrossel ---------- */}
      <section aria-label="Serviços disponíveis" className="border-b border-line bg-white py-8">
        <ServiceMarquee />
      </section>

      {/* ---------- Como funciona ---------- */}
      <section aria-labelledby="how" className="mx-auto max-w-6xl px-5 pt-16 sm:px-8">
        <SectionHead icon={ListOrdered} eyebrow="Como funciona" id="how" title="Três passos. Nenhuma fila." sub="Do sofá, do trabalho ou do outro lado do mundo." />
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            [MousePointerClick, "Escolha o serviço", "Pesquise pela instituição ou pelo que quer pagar: fatura, multa, propina, passaporte."],
            [CircleDollarSign, "Confirme o valor", "Introduza o contador, o NUIT ou a referência. O valor vem do sistema da instituição, sem margem para erro."],
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
      <section aria-labelledby="cat-title" className="mx-auto max-w-6xl px-5 pt-16 sm:px-8">
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
          <ul className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/servicos?categoria=${c.slug}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-ink hover:shadow-2xl sm:p-6">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-canvas text-ink transition duration-300 group-hover:bg-ink group-hover:text-white">
                    <CategoryIcon slug={c.slug} />
                  </span>
                  <span lang="pt" className="mt-8 hyphens-auto font-display text-base font-bold leading-snug [overflow-wrap:anywhere] sm:text-lg">{c.name}</span>
                  <span className="mt-1 text-sm text-muted">{c.service_count} serviços</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Porquê (bento) ---------- */}
      <section aria-labelledby="why" className="mx-auto max-w-6xl px-5 pt-16 sm:px-8">
        <SectionHead icon={ShieldCheck} eyebrow="Porquê PagaMOZ" id="why" title="Feito para confiar." sub="Para quem paga e para quem recebe." />
        <div className="mt-10 grid gap-5 md:grid-cols-6">
          <article className="relative overflow-hidden rounded-[var(--radius-card)] bg-ink p-8 text-white md:col-span-4">
            <ShieldCheck className="h-7 w-7 text-accent" strokeWidth={1.8} />
            <h3 className="mt-6 max-w-md text-2xl font-bold sm:text-3xl">O dinheiro vai directo para a instituição.</h3>
            <p className="mt-2 max-w-md text-sm text-white/60">O PagaMOZ confirma e regista. Não fica com os fundos, nem por um dia.</p>
            <ol className="mt-10 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center text-xs font-semibold sm:text-sm">
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
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-canvas px-4 py-2.5 font-medium">pagamoz · Fatura de água: 1 250,00 MT</p>
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
      <section aria-labelledby="track-title" className="mx-auto max-w-6xl px-5 pt-16 sm:px-8">
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
      <section aria-labelledby="faq" className="mx-auto max-w-6xl px-5 pt-16 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHead icon={HelpCircle} eyebrow="Perguntas frequentes" id="faq" title="Tudo o que precisa de saber." sub="Respostas curtas às dúvidas mais comuns." />
            <div className="mt-8 rounded-[var(--radius-card)] bg-ink p-6 text-white">
              <MessageCircleQuestion className="h-6 w-6 text-accent" />
              <p className="mt-4 font-display text-lg font-bold">Tem um código de pagamento?</p>
              <p className="mt-1 text-sm text-white/60">Veja o estado e descarregue o comprovativo.</p>
              <div className="glass-dark mt-5 inline-flex rounded-full p-1.5">
                <Link href="/verificar" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink hover:bg-white/90">
                  <QrCode className="h-4 w-4" /> Verificar comprovativo
                </Link>
              </div>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {FAQ.map(({ icon: I, q, a }) => (
              <li key={q}>
                <details className="group h-full rounded-[var(--radius-card)] border border-line bg-white p-5 transition open:border-ink open:shadow-lg [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-canvas transition group-open:bg-ink group-open:text-white"><I className="h-5 w-5" /></span>
                    <span className="flex-1 pt-2 font-semibold leading-snug">{q}</span>
                    <ChevronDown className="mt-2.5 h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 pl-[52px] text-sm leading-relaxed text-muted">{a}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- Instituições ---------- */}
      <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-8">
        <div className="relative overflow-hidden rounded-[2rem] bg-ink p-8 text-white sm:p-14">
          <div className="relative grid grid-cols-1 items-center gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div>
              <Eyebrow dark icon={Building2}>Para instituições</Eyebrow>
              <h2 className="mt-6 text-3xl font-bold sm:text-4xl">Recebe pagamentos de serviços?</h2>
              <p className="mt-3 max-w-lg text-white/65">Veja os recebimentos em tempo real, a reconciliação diária e cada lote liquidado na sua conta, num só portal.</p>
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
              <p className="mt-2 font-display text-3xl font-bold">1 284 960,00 MT</p>
              <div className="mt-6 space-y-3">
                {[["Recarga Credelec", "98%"], ["Fatura pós-paga", "76%"], ["Outros", "31%"]].map(([l, w]) => (
                  <div key={l}>
                    <div className="flex justify-between text-xs text-white/60"><span>{l}</span><span>{w}</span></div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/10"><div className="h-1.5 rounded-full bg-white" style={{ width: w }} /></div>
                  </div>
                ))}
              </div>
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
      <h2 id={id} className="mt-4 max-w-xl text-4xl font-bold leading-[1.05] sm:text-5xl">{title}</h2>
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
  // Fotografia (Shixart1985, CC BY 2.0) escurecida para o texto branco se ler bem.
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <img src="/hero.webp" alt="" className="h-full w-full object-cover opacity-40" />
      <div className="absolute inset-0 bg-ink/80" />
    </div>
  );
}
