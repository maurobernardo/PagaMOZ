"use client";

import { ArrowRight, ArrowUpRight, Building2, FlaskConical, LayoutGrid, MapPin, Menu, ShieldCheck, MessageCircle, User, X, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./logo";
import { Prefs } from "./prefs";
import { BrandMark } from "./brand-mark";
import { METHOD_ICON } from "./method-icon";
import { METHOD_LABEL } from "@/lib/i18n";

const LINKS = [
  { href: "/servicos", label: "Serviços", icon: LayoutGrid },
  { href: "/assistente", label: "Assistente", icon: MessageCircle },
  { href: "/verificar", label: "Verificar comprovativo", icon: ShieldCheck },
  { href: "/portal", label: "Para instituições", icon: Building2 },
];

/** Barra flutuante em vidro. Na página inicial fica escura sobre o hero; no resto do site é clara. */
export function SiteHeader() {
  const path = usePathname();
  const dark = false;
  const home = path === "/";
  const [open, setOpen] = useState(false);

  return (
    <header className={`${home ? "absolute" : "sticky"} inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4`}>
      <nav aria-label="Principal"
        className={`mx-auto flex max-w-6xl items-center gap-2 rounded-full py-2 pl-4 pr-2 ${dark ? "glass-dark" : "glass !bg-white/85 shadow-[var(--shadow-soft)]"}`}>
        <Link href="/" aria-label="PagaMOZ, início" className="mr-auto"><Logo inverted={dark} /></Link>
        <ul className="hidden items-center gap-1 text-sm font-semibold md:flex">
          {LINKS.map(({ href, label, icon: I }) => {
            const active = path.startsWith(href);
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 transition ${
                    dark ? (active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white")
                      : (active ? "bg-white text-ink" : "text-ink/65 hover:bg-white hover:text-ink")}`}>
                  <I className="h-4 w-4" strokeWidth={2} /> {label}
                </Link>
              </li>
            );
          })}
        </ul>
        <Prefs dark={dark} />
        <Link href="/conta"
          className={`hidden min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition md:inline-flex ${dark ? "bg-white text-ink hover:bg-white/90" : "bg-ink text-white hover:bg-ink/85"}`}>
          <User className="h-4 w-4" /> A minha conta
        </Link>
        <button aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} onClick={() => setOpen(!open)}
          className={`grid h-10 w-10 place-items-center rounded-full md:hidden ${dark ? "bg-white/10 text-white" : "bg-white text-ink"}`}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>
      {open ? (
        <div className={`mx-auto mt-2 max-w-6xl animate-rise rounded-3xl p-2 md:hidden ${dark ? "glass-dark" : "glass bg-white/90"}`}>
          {[...LINKS, { href: "/conta", label: "A minha conta", icon: User }].map(({ href, label, icon: I }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 font-semibold ${dark ? "text-white hover:bg-white/10" : "text-ink hover:bg-ink/5"}`}>
              <I className="h-4 w-4" /> {label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}

const FOOTER = [
  { title: "Cidadãos", links: [["/servicos", "Pagar um serviço"], ["/verificar", "Verificar comprovativo"], ["/conta", "A minha conta"], ["/entrar", "Entrar"]] },
  { title: "Instituições", links: [["/portal", "Entrar no portal"], ["/portal", "Reconciliação e relatórios"], ["/portal", "Liquidação directa"]] },
  { title: "Plataforma", links: [["/health", "Estado do sistema"], ["/verificar", "Autenticidade dos comprovativos"]] },
] as const;

export function SiteFooter() {
  return (
    <footer className="theme-flip relative mt-20 overflow-hidden bg-ink text-white">

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        {/* Convite */}
        <div className="flex flex-col items-start justify-between gap-8 border-b border-white/10 py-16 md:flex-row md:items-end">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
              <Zap className="h-3.5 w-3.5 text-accent" /> Sem filas, sem papel
            </p>
            <p className="mt-4 max-w-xl font-display text-4xl font-bold leading-[1.05] sm:text-5xl">Pague a próxima conta em três passos.</p>
          </div>
          <div className="glass-dark flex flex-wrap gap-2 rounded-full p-2">
            <Link href="/servicos" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-ink transition hover:bg-white/90">
              Ver serviços <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/verificar" className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-semibold text-white transition hover:bg-white/10">
              <ShieldCheck className="h-4 w-4" /> Verificar comprovativo
            </Link>
          </div>
        </div>

        {/* Navegação */}
        <div className="grid grid-cols-2 gap-10 py-14 md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
          <div className="col-span-2 md:col-span-1">
            <Logo inverted />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/55">
              O dinheiro vai directamente para a conta da instituição. O PagaMOZ confirma, regista e prova. Não guarda fundos.
            </p>
            <div className="glass-dark mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white/70">
              <MapPin className="h-3.5 w-3.5 text-accent" /> Feito para Moçambique · Maputo
            </div>
          </div>
          {FOOTER.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">{col.title}</p>
              <ul className="mt-5 space-y-3 text-sm">
                {col.links.map(([href, label]) => (
                  <li key={label}>
                    <Link href={href} className="group inline-flex items-center gap-1.5 text-white/70 transition hover:text-white">
                      {label}
                      <ArrowUpRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Métodos */}
        <ul aria-label="Métodos de pagamento" className="flex flex-wrap gap-2 border-t border-white/10 py-8">
          {Object.entries(METHOD_LABEL).map(([k, m]) => {
            const I = METHOD_ICON[k];
            return (
              <li key={k} className="glass-dark inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-xs font-semibold text-white/70">
                {k === "cartao" ? (
                  <><BrandMark slug="visa" name="Visa" size={28} className="!rounded-full" /><BrandMark slug="mastercard" name="Mastercard" size={28} className="!rounded-full" /></>
                ) : ["mpesa", "emola", "mkesh"].includes(k) ? (
                  <BrandMark slug={k} name={m} size={28} className="!rounded-full !text-[10px]" />
                ) : (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-ink"><I className="h-3.5 w-3.5" /></span>
                )}{m}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Assinatura */}
      <p aria-hidden className="pointer-events-none relative select-none text-center font-display text-[24vw] font-extrabold leading-[0.78] tracking-[-0.06em] text-transparent [-webkit-text-stroke:1px_color-mix(in_srgb,var(--color-white)_14%,transparent)] sm:text-[19vw]">
        pagamoz
      </p>

      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} PagaMOZ · Protótipo com pagamentos simulados.</p>
          <p className="flex gap-4">
            <Link href="/termos" className="hover:text-white">Termos</Link>
            <Link href="/privacidade" className="hover:text-white">Privacidade</Link>
            <Link href="/cookies" className="hover:text-white">Cookies</Link>
          </p>
          <p className="inline-flex items-center gap-2"><FlaskConical className="h-3.5 w-3.5 text-accent" /> Ambiente de demonstração</p>
        </div>
      </div>
    </footer>
  );
}
