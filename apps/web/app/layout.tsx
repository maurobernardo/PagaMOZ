import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PagaMOZ — pague serviços sem ir ao balcão", template: "%s · PagaMOZ" },
  description: "Pague água, energia, impostos, propinas e documentos num só lugar e receba um comprovativo verificável.",
  applicationName: "PagaMOZ",
};

export const viewport: Viewport = { themeColor: "#0b3d2e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-MZ">
      <body className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 antialiased">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Saltar para o conteúdo
        </a>
        <div role="note" className="bg-amber-300 px-4 py-1.5 text-center text-xs font-semibold text-amber-950 sm:text-sm">
          AMBIENTE DE DEMONSTRAÇÃO — pagamentos simulados, sem valor real
        </div>
        <header className="bg-brand-900 text-white">
          <nav aria-label="Principal" className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
            <Link href="/" className="mr-auto flex items-center gap-2 text-lg font-extrabold tracking-tight">
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-white text-sm font-black text-brand-900">
                PM
              </span>
              PagaMOZ
            </Link>
            <Link href="/servicos" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10">
              Serviços
            </Link>
            <Link href="/conta" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10">
              <Icon name="user" className="h-5 w-5" />
              <span>Conta</span>
            </Link>
          </nav>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-6 text-sm text-slate-600 sm:flex-row sm:justify-between">
            <p>O dinheiro vai directamente para a conta da instituição. O PagaMOZ não guarda fundos.</p>
            <p>
              <Link href="/verificar" className="font-medium text-brand-800 underline">Verificar comprovativo</Link>
              {" · "}Protótipo · instituições fictícias
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
