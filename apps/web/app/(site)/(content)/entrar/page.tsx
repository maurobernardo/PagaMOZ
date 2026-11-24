"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { GOOGLE_ERRORS, GoogleButton, OrDivider } from "@/components/google-button";
import { Alert, Button, Card, Field, PageTitle } from "@/components/ui";
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
  const params = useSearchParams();
  const next = params.get("next");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [demoCode, setDemoCode] = useState("");
  const [error, setError] = useState(GOOGLE_ERRORS[params.get("erro") ?? ""] ?? "");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) return setError("Número inválido. Exemplo: 84 123 4567.");
    setBusy(true);
    setError("");
    const r = await api.POST("/api/auth/otp/request", { body: { phone: normalizePhone(phone) } });
    setBusy(false);
    if (!r.data) return setError(errorMessage(r.error));
    setSent(true);
    setDemoCode(r.data.demo_code ?? "");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await api.POST("/api/auth/otp/verify", { body: { phone: normalizePhone(phone), code } });
    setBusy(false);
    if (!r.data) return setError(errorMessage(r.error));
    // só caminhos internos (evita redireccionamento aberto)
    router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/conta");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm">
      <PageTitle sub="Sem palavra-passe: enviamos um código para o seu telemóvel.">Entrar</PageTitle>
      <Card>
        {error ? <div className="mb-4"><Alert>{error}</Alert></div> : null}
        {!sent ? (
          <>
          <GoogleButton flow="cidadao" next={next?.startsWith("/") && !next.startsWith("//") ? next : "/conta"} />
          <OrDivider />
          <form onSubmit={requestCode} className="space-y-4" noValidate>
            <Field id="phone" label="Número de telemóvel" type="tel" inputMode="tel" autoComplete="tel"
              placeholder="84 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button type="submit" disabled={busy || !ready} className="w-full">{busy ? "A enviar…" : "Receber código"}</Button>
          </form>
          </>
        ) : (
          <form onSubmit={verify} className="space-y-4" noValidate>
            <p className="text-sm text-ink/80">Enviámos um código de 6 dígitos para {normalizePhone(phone)}.</p>
            {demoCode ? (
              <Alert tone="wait">Demonstração: o código é <strong className="font-mono">{demoCode}</strong></Alert>
            ) : null}
            <Field id="code" label="Código" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <Button type="submit" disabled={busy || code.length !== 6} className="w-full">
              {busy ? "A verificar…" : "Entrar"}
            </Button>
            <button type="button" className="min-h-11 w-full text-sm text-muted hover:underline" onClick={() => setSent(false)}>
              Mudar número
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
