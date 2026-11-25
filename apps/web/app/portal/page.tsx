"use client";

import { Building2, KeyRound, Scale, ShieldCheck, Smartphone, Wallet } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { GOOGLE_ERRORS, GoogleButton, OrDivider } from "@/components/google-button";
import { AuthFrame } from "@/components/auth-frame";
import { Alert, Button, Field } from "@/components/ui";
import { api, errorMessage, type Schemas } from "@/lib/api";
import { isValidPhone, normalizePhone } from "@/lib/i18n";

type Step = "password" | "setup" | "mfa" | "choose";

export default function PortalLoginPage() {
  return (
    <Suspense>
      <PortalLogin />
    </Suspense>
  );
}

function PortalLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<Step>("password");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [memberships, setMemberships] = useState<Schemas["Membership"][]>([]);
  const [staff, setStaff] = useState(false);
  const [error, setError] = useState(GOOGLE_ERRORS[params.get("erro") ?? ""] ?? "");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    if (params.get("google") !== "1") return;
    // Voltou da Google: a palavra-passe está dispensada, falta o MFA.
    api.GET("/api/auth/portal/pending").then(async (r) => {
      if (!r.data) return setError(errorMessage(r.error));
      if (r.data.mfa_enrolled) {
        setDemoCode(r.data.demo_code ?? "");
        setStep("mfa");
      } else await setup();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setup() {
    const s = await api.POST("/api/auth/portal/mfa/setup");
    if (!s.data) return setError(errorMessage(s.error));
    setSecret(s.data.secret);
    setDemoCode(s.data.demo_code ?? "");
    setStep("setup");
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) return setError("Número inválido. Exemplo: 84 000 0001.");
    setBusy(true);
    setError("");
    const r = await api.POST("/api/auth/portal/login", { body: { phone: normalizePhone(phone), password } });
    setBusy(false);
    if (!r.data) return setError(errorMessage(r.error));
    if (r.data.mfa_enrolled) {
      setDemoCode(r.data.demo_code ?? "");
      setStep("mfa");
    } else await setup();
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

  const steps = [["password", "Identificação"], ["mfa", "Verificação"], ["choose", "Instituição"]] as const;
  const idx = step === "setup" ? 1 : steps.findIndex(([k]) => k === step);

  const title = step === "password" ? "Portal da instituição" : step === "setup" ? "Proteja a sua conta" : step === "mfa" ? "Confirme que é você" : "Escolha onde entrar";
  const sub = step === "password" ? "Acesso para as equipas das instituições aderentes." : step === "setup" ? "Configure uma app autenticadora. Só precisa de fazer isto uma vez." : step === "mfa" ? "Introduza o código de 6 dígitos da sua app autenticadora." : "A sua conta tem acesso a mais de um espaço.";

  return (
    <AuthFrame eyebrow="Portal das instituições" icon={Building2} title={title} sub={sub}
      footer={<span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Acesso protegido com verificação em dois passos</span>}>
      <ol className="mb-8 flex gap-2" aria-label="Passos">
        {steps.map(([k, l], i) => (
          <li key={k} aria-current={i === idx ? "step" : undefined} className="flex-1">
            <span className={`block h-1 rounded-full ${i <= idx ? "bg-ink" : "bg-line"}`} />
            <span className={`mt-2 block text-xs font-semibold ${i <= idx ? "text-ink" : "text-muted"}`}>{l}</span>
          </li>
        ))}
      </ol>

      {error ? <div className="mb-5"><Alert>{error}</Alert></div> : null}

      {step === "password" && (
        <>
          <GoogleButton flow="portal" />
          <OrDivider />
          <form onSubmit={login} className="space-y-5" noValidate>
            <Field id="phone" label="Telefone" type="tel" autoComplete="username" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="84 000 0001" />
            <Field id="password" label="Palavra-passe" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" disabled={busy || !ready} className="w-full !min-h-12">{busy ? "A verificar…" : "Continuar"}</Button>
          </form>
          <ul className="mt-8 grid grid-cols-3 gap-2 border-t border-line pt-6 text-center text-xs">
            {[[Wallet, "Recebe directo na sua conta"], [Scale, "Reconciliação diária"], [ShieldCheck, "Auditoria completa"]].map(([I, t]) => {
              const Icon = I as typeof Wallet;
              return (
                <li key={String(t)} className="rounded-2xl bg-canvas px-2 py-3">
                  <Icon className="mx-auto h-4 w-4" />
                  <span className="mt-1.5 block font-semibold leading-tight">{String(t)}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {(step === "mfa" || step === "setup") && (
        <form onSubmit={verify} className="space-y-5" noValidate>
          {step === "setup" ? (
            <div className="rounded-3xl bg-canvas p-5">
              <div className="flex items-center gap-3 text-sm font-semibold"><Smartphone className="h-5 w-5" /> Google Authenticator, Microsoft Authenticator, Aegis…</div>
              <p className="mt-3 text-sm text-muted">Adicione uma conta com esta chave:</p>
              <p className="mt-2 break-all rounded-2xl bg-white p-3 font-mono text-base tracking-wider">{secret}</p>
            </div>
          ) : null}
          {demoCode ? (
            <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3 text-sm">
              <KeyRound className="h-4 w-4 text-accent" /> Demonstração: código actual <strong className="font-mono text-base tracking-widest">{demoCode}</strong>
            </div>
          ) : null}
          <Field id="code" label="Código" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <Button type="submit" disabled={busy || code.length !== 6} className="w-full !min-h-12">{busy ? "A verificar…" : "Entrar"}</Button>
        </form>
      )}

      {step === "choose" && (
        <div className="space-y-3">
          {staff ? <Button className="w-full !min-h-12" onClick={() => router.replace("/backoffice")}>Backoffice da plataforma</Button> : null}
          {memberships.map((m) => (
            <Button key={m.institution.slug} variant="secondary" className="w-full !min-h-12" onClick={() => router.replace(`/portal/${m.institution.slug}`)}>
              {m.institution.name}
            </Button>
          ))}
        </div>
      )}
    </AuthFrame>
  );
}
