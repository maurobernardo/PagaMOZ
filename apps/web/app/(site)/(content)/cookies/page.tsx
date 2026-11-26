import { Cookie } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/eyebrow";
import { TERMS } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de cookies" };

// Só o que o site guarda de facto (ver lib/api.ts, components/prefs.tsx e a sessão do Django).
const ROWS = [
  ["sessionid", "Cookie", "Mantém a sessão depois de entrar.", "14 dias ou até sair"],
  ["csrftoken", "Cookie", "Protege os formulários contra pedidos falsos.", "1 ano"],
  ["theme", "Armazenamento local", "Lembra o modo claro ou escuro.", "Até o apagar"],
  ["lang", "Armazenamento local", "Lembra o idioma (PT ou EN).", "Até o apagar"],
  ["cookies-ok", "Armazenamento local", "Lembra que já viu este aviso.", "Até o apagar"],
  ["pagamoz-3ds:…", "Armazenamento da sessão", "Código de teste do cartão (só na demonstração).", "Até fechar o separador"],
];

export default function Cookies() {
  return (
    <div className="mx-auto max-w-3xl">
      <Eyebrow icon={Cookie}>{TERMS.updated}</Eyebrow>
      <h1 className="mt-4 text-4xl font-bold">Política de cookies</h1>
      <p className="mt-4 leading-relaxed text-muted">
        O PagaMOZ usa apenas cookies e armazenamento necessários para o site funcionar. Não usamos cookies de publicidade
        nem de análise, e não partilhamos estes dados com terceiros.
      </p>
      <ul className="mt-8 space-y-3">
        {ROWS.map(([name, type, why, time]) => (
          <li key={name} className="rounded-[var(--radius-card)] border border-line bg-white p-5">
            <p className="flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-canvas px-2 py-0.5 font-mono text-sm font-bold">{name}</code>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">{type}</span>
            </p>
            <p className="mt-2">{why}</p>
            <p className="mt-1 text-sm text-muted">Duração: {time}</p>
          </li>
        ))}
      </ul>
      <p className="mt-8 leading-relaxed text-muted">
        Pode apagar tudo nas definições do seu browser. Se apagar o cookie de sessão, terá de entrar de novo.
        Veja também a <Link href="/privacidade" className="font-semibold text-ink underline">política de privacidade</Link>.
      </p>
    </div>
  );
}
