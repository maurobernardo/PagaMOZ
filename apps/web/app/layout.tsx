import { THEME_SCRIPT } from "@/lib/theme-script";
import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { PresenterFlag } from "@/components/presenter-flag";
import { Toaster } from "@/components/toast";
import "./globals.css";

const display = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-display-face", display: "swap" });
const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face", display: "swap", weight: ["500", "700"] });

export const metadata: Metadata = {
  title: { default: "PagaMOZ: pague serviços sem ir ao balcão", template: "%s · PagaMOZ" },
  description: "Pague água, energia, impostos, propinas e documentos num só lugar e receba um comprovativo verificável.",
  applicationName: "PagaMOZ",
};

export const viewport: Viewport = { themeColor: "#0b0b0c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-MZ" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
          Saltar para o conteúdo
        </a>
        <PresenterFlag />
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
