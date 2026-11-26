"use client";

import { KeyRound, MessageSquareText, RefreshCw, Smartphone, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { GOOGLE_ERRORS, GoogleButton, OrDivider } from "@/components/google-button";
import { useToast } from "@/components/toast";
import { ProfileForm } from "@/components/profile-form";
import { Alert, Button, Toolbar } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { isValidPhone, normalizePhone } from "@/lib/i18n";

export default function EntrarPage() {
  return (
    <Suspense>
      <Entrar />
    </Suspense>
  );
}

function Entrar() {
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const next = params.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/conta";
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [profile, setProfile] = useState<Record<string, string> | null>(null);
  const [demoCode, setDemoCode] = useState("");
  const [error, setError] = useState(GOOGLE_ERRORS[params.get("erro") ?? ""] ?? "");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (!isValidPhone(phone)) return setError("Número inválido. Exemplo: 84 123 4567.");
    setBusy(true);
    setError("");
    const r = await api.POST("/api/auth/otp/request", { body: { phone: normalizePhone(phone) } });
    setBusy(false);
    if (!r.data) return setError(errorMessage(r.error));
    setSent(true);
    setWait(30);
    setDemoCode(r.data.demo_code ?? "");
    toast(`Código enviado para ${normalizePhone(phone)}.`, "info");
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await api.POST("/api/auth/otp/verify", { body: { phone: normalizePhone(phone), code } });
    setBusy(false);
    if (!r.data) return setError(errorMessage(r.error));
    // Conta nova (ou incompleta): pede nome, província e distrito antes de seguir.
    const me = await api.GET("/api/me");
    const m = me.data as Record<string, string> | undefined;
    if (m && !(m.first_name && m.province && m.district)) return setProfile(m);
    toast("Bem-vindo de volta.");
    router.replace(safeNext);
    router.refresh();
  }

  return (
    <AuthFrame
      eyebrow="Conta de cidadão"
      icon={UserRound}
      title={profile ? "Os seus dados" : sent ? "Introduza o código" : "Entrar ou criar conta"}
      sub={profile ? "Para os comprovativos e lembretes da sua zona. Só precisa de fazer isto uma vez." : sent ? <>Enviámos 6 dígitos para <strong className="text-ink">{normalizePhone(phone)}</strong>.</> : "Sem palavra-passe: enviamos um código para o seu telemóvel."}
      footer={<>É de uma instituição? <Link href="/portal" className="font-semibold text-ink underline-offset-4 hover:underline">Entrar no portal</Link></>}
    >
      {error ? <div className="mb-6"><Alert>{error}</Alert></div> : null}

      {profile ? (
        <ProfileForm initial={profile} cta="Concluir" onSaved={() => { toast("Conta pronta."); router.replace(safeNext); router.refresh(); }} />
      ) : !sent ? (
        <>
          <GoogleButton flow="cidadao" next={safeNext} />
          <OrDivider />
          <form onSubmit={requestCode} className="space-y-6" noValidate>
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold">Número de telemóvel</label>
              <div className="mt-1.5 flex min-h-14 items-center rounded-2xl border border-line bg-white focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/5">
                <span className="flex items-center gap-2 border-r border-line px-4 font-semibold text-muted"><Smartphone className="h-4 w-4" /> +258</span>
                <input id="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="84 123 4567" value={phone}
                  onChange={(e) => setPhone(e.target.value)} className="min-w-0 flex-1 bg-transparent px-4 text-lg tracking-wide focus:outline-none" />
              </div>
              <p className="mt-1.5 text-sm text-muted">Qualquer número moçambicano.</p>
            </div>
            <Button type="submit" disabled={busy || !ready} className="w-full !min-h-12">
              <MessageSquareText className="h-4 w-4" /> {busy ? "A enviar…" : "Receber código"}
            </Button>
          </form>
        </>
      ) : (
        <form onSubmit={verify} className="space-y-6" noValidate>
          {demoCode ? (
            <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3 text-sm">
              <KeyRound className="h-4 w-4 shrink-0 text-accent" />
              <span>Demonstração: o código é <strong className="font-mono text-base tracking-widest">{demoCode}</strong></span>
            </div>
          ) : null}
          <div>
            <label htmlFor="code" className="block text-sm font-semibold">Código</label>
            <input ref={codeRef} id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••••"
              className="mt-1.5 block min-h-16 w-full rounded-2xl border border-line bg-white text-center font-mono text-3xl tracking-[0.6em] placeholder:text-line focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/5" />
          </div>
          <Button type="submit" disabled={busy || code.length !== 6} className="w-full !min-h-12">{busy ? "A verificar…" : "Entrar"}</Button>
          <Toolbar className="flex w-full justify-between">
            <Button type="button" variant="ghost" className="!min-h-10 text-sm" onClick={() => { setSent(false); setCode(""); }}>
              <Smartphone className="h-4 w-4" /> Mudar número
            </Button>
            <Button type="button" variant="ghost" className="!min-h-10 text-sm" disabled={wait > 0 || busy} onClick={() => requestCode()}>
              <RefreshCw className="h-4 w-4" /> {wait > 0 ? `Reenviar em ${wait}s` : "Reenviar código"}
            </Button>
          </Toolbar>
        </form>
      )}
    </AuthFrame>
  );
}
