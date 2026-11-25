import { ArrowLeft, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Logo } from "./logo";
import { Eyebrow } from "./eyebrow";

/** Página de entrada: uma só coluna, cartão central, sem painéis de cor. */
export function AuthFrame({ eyebrow, icon, title, sub, children, footer }: {
  eyebrow: string; icon: LucideIcon; title: string; sub: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 pt-6 sm:px-8">
        <Link href="/" aria-label="PagaMOZ, início"><Logo /></Link>
        <div className="glass inline-flex rounded-full p-1.5">
          <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold transition hover:bg-ink hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Voltar ao site
          </Link>
        </div>
      </header>

      <main id="conteudo" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
        <div className="text-center">
          <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] sm:text-[2.75rem]">{title}</h1>
          <p className="mt-3 text-muted">{sub}</p>
        </div>
        <div className="mt-8 rounded-[2rem] border border-line bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">{children}</div>
        {footer ? <div className="mt-6 text-center text-sm text-muted">{footer}</div> : null}
      </main>
    </div>
  );
}
