"use client";

import { Cookie } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Aviso ao entrar: o site só usa cookies necessários, por isso basta tomar conhecimento. */
export function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { setShow(!localStorage.getItem("cookies-ok")); } catch { setShow(true); }
  }, []);
  if (!show) return null;
  const ok = () => {
    try { localStorage.setItem("cookies-ok", "1"); } catch { /* vale só nesta visita */ }
    setShow(false);
  };
  return (
    <div role="dialog" aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl animate-rise rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-2xl sm:bottom-5">
      <p className="flex items-center gap-2 font-display font-bold"><Cookie className="h-5 w-5" /> Cookies</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Usamos apenas cookies necessários: manter a sessão, proteger formulários e lembrar o tema e o idioma. Sem publicidade nem análise.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={ok} className="frame-none inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white hover:bg-ink/85">
          Aceitar
        </button>
        <Link href="/cookies" className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm font-semibold hover:border-ink">
          Política de cookies
        </Link>
      </div>
    </div>
  );
}
