import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PagaMOZ",
  description: "Pague serviços, taxas e contas sem ir ao balcão.",
};

export const viewport: Viewport = { themeColor: "#0b3d2e" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-MZ">
      <body className="min-h-dvh bg-white text-slate-900 antialiased">
        <div role="status" className="bg-amber-300 px-4 py-1 text-center text-sm font-semibold text-amber-950">
          AMBIENTE DE DEMONSTRAÇÃO — pagamentos simulados, sem valor real
        </div>
        {children}
      </body>
    </html>
  );
}
