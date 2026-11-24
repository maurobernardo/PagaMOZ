"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Field, PageTitle } from "@/components/ui";
import { api, errorMessage, type Schemas } from "@/lib/api";
import { isValidPhone, normalizePhone } from "@/lib/i18n";

type Step = "password" | "setup" | "mfa" | "choose";

export default function PortalLogin() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("password");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [memberships, setMemberships] = useState<Schemas["Membership"][]>([]);
  const [staff, setStaff] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) return setError("Número inválido.");
    setBusy(true);
    setError("");
    const r = await api.POST("/api/auth/portal/login", { body: { phone: normalizePhone(phone), password } });
    setBusy(false);
    if (!r.data) return setError(errorMessage(r.error));
    if (r.data.mfa_enrolled) {
      setDemoCode(r.data.demo_code ?? "");
      setStep("mfa");
    } else {
      const s = await api.POST("/api/auth/portal/mfa/setup");
      if (!s.data) return setError(errorMessage(s.error));
      setSecret(s.data.secret);
      setDemoCode(s.data.demo_code ?? "");
      setStep("setup");
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await api.POST("/api/auth/portal/mfa/verify", { body: { code } });
    setBusy(false);
    if (!r.data) return setError(errorMessage(r.error));
    const ms = r.data.memberships;
    if (r.data.is_staff && ms.length === 0) router.replace("/backoffice");
    else if (ms.length === 1 && !r.data.is_staff) router.replace(`/portal/${ms[0].institution.slug}`);
    else {
      setMemberships(ms);
      setStaff(r.data.is_staff);
      setStep("choose");
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <PageTitle sub="Acesso para equipas das instituições aderentes.">Portal da instituição</PageTitle>
      <Card>
        {error ? <div className="mb-4"><Alert>{error}</Alert></div> : null}

        {step === "password" && (
          <form onSubmit={login} className="space-y-4" noValidate>
            <Field id="phone" label="Telefone" type="tel" autoComplete="username" value={phone}
              onChange={(e) => setPhone(e.target.value)} placeholder="84 000 0001" />
            <Field id="password" label="Palavra-passe" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" disabled={busy || !ready} className="w-full">{busy ? "A verificar…" : "Continuar"}</Button>
          </form>
        )}

        {(step === "mfa" || step === "setup") && (
          <form onSubmit={verify} className="space-y-4" noValidate>
            {step === "setup" ? (
              <div className="space-y-2 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Configure a verificação em dois passos</p>
                <p>Na app autenticadora (Google Authenticator, Microsoft Authenticator, Aegis…), adicione uma conta com esta chave:</p>
                <p className="break-all rounded-lg bg-slate-100 p-3 font-mono text-base tracking-wider">{secret}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-700">Introduza o código de 6 dígitos da sua app autenticadora.</p>
            )}
            {demoCode ? <Alert tone="wait">Demonstração: código actual <strong className="font-mono">{demoCode}</strong></Alert> : null}
            <Field id="code" label="Código" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <Button type="submit" disabled={busy || code.length !== 6} className="w-full">{busy ? "A verificar…" : "Entrar"}</Button>
          </form>
        )}

        {step === "choose" && (
          <div className="space-y-2">
            <p className="text-sm text-slate-700">Escolha a instituição:</p>
            {staff ? (
              <Button className="w-full" onClick={() => router.replace("/backoffice")}>Backoffice da plataforma</Button>
            ) : null}
            {memberships.map((m) => (
              <Button key={m.institution.slug} variant="secondary" className="w-full"
                onClick={() => router.replace(`/portal/${m.institution.slug}`)}>
                {m.institution.name}
              </Button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
