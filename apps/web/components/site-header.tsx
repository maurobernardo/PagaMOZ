"use client";

import { Building2, Menu, ShieldCheck, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./logo";

const LINKS = [
  { href: "/servicos", label: "Serviços" },
  { href: "/verificar", label: "Verificar comprovativo", icon: ShieldCheck },
  { href: "/portal", label: "Para instituições", icon: Building2 },
];

/** Na página inicial fica escuro sobre o hero; no resto do site é branco. */
export function SiteHeader() {
  const path = usePathname();
  const dark = path === "/";
  const [open, setOpen] = useState(false);
  const link = dark ? "text-white/75 hover:text-white" : "text-muted hover:text-ink";

  return (
    <header className={dark ? "absolute inset-x-0 z-40" : "sticky top-0 z-40 border-b border-line/80 bg-canvas/85 backdrop-blur-md"}>
      <nav aria-label="Principal" className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4 sm:px-8">
        <Link href="/" aria-label="PagaMOZ — início" className="mr-auto">
          <Logo inverted={dark} />
        </Link>
        <ul className="hidden items-center gap-7 text-sm font-medium md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} aria-current={path.startsWith(l.href) ? "page" : undefined}
                className={`transition ${link} aria-[current=page]:font-semibold ${dark ? "aria-[current=page]:text-white" : "aria-[current=page]:text-ink"}`}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/conta"
          className={`hidden min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition md:inline-flex ${dark ? "bg-white text-ink hover:bg-white/90" : "bg-ink text-white hover:bg-ink/85"}`}>
          <User className="h-4 w-4" /> A minha conta
        </Link>
        <button aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} onClick={() => setOpen(!open)}
          className={`grid h-10 w-10 place-items-center rounded-full md:hidden ${dark ? "glass-dark text-white" : "glass text-ink"}`}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>
      {open ? (
        <div className={`mx-5 mb-3 rounded-3xl p-2 md:hidden ${dark ? "glass-dark" : "glass"}`}>
          {[...LINKS, { href: "/conta", label: "A minha conta", icon: User }].map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={`flex min-h-12 items-center rounded-2xl px-4 font-medium ${dark ? "text-white hover:bg-white/10" : "text-ink hover:bg-ink/5"}`}>
              {l.label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-muted">
            O dinheiro vai directamente para a conta da instituição. O PagaMOZ confirma, regista e prova — não guarda fundos.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Cidadãos</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li><Link className="hover:text-ink" href="/servicos">Pagar um serviço</Link></li>
            <li><Link className="hover:text-ink" href="/verificar">Verificar comprovativo</Link></li>
            <li><Link className="hover:text-ink" href="/conta">A minha conta</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Instituições</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li><Link className="hover:text-ink" href="/portal">Entrar no portal</Link></li>
          </ul>
          <p className="mt-6 text-xs text-muted">Protótipo · instituições e pagamentos fictícios</p>
        </div>
      </div>
    </footer>
  );
}
