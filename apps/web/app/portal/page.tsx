"use client";

import { ArrowLeft, Banknote, KeyRound, Scale, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { GOOGLE_ERRORS, GoogleButton, OrDivider } from "@/components/google-button";
import { Logo } from "@/components/logo";
import { Alert, Button, Eyebrow, Field } from "@/components/ui";
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

  return (
    <div className="grid min-h-[calc(100dvh-28px)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_top_left,black_20%,transparent_70%)]" />
        <div aria-hidden className="absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-3xl" />
        <Link href="/" className="relative"><Logo inverted /></Link>
        <div className="relative mt-auto">
          <Eyebrow dark>Portal das instituições</Eyebrow>
          <p className="mt-6 max-w-md font-display text-5xl font-bold leading-[1.05]">O seu dinheiro, conferido todos os dias.</p>
          <ul className="mt-10 space-y-4 text-white/75">
            {[
              [Banknote, "Liquidação directa na conta da instituição"],
              [Scale, "Reconciliação automática com o provedor"],
              [ShieldCheck, "Acesso com verificação em dois passos"],
            ].map(([I, t]) => {
              const Icon = I as typeof Banknote;
              return <li key={String(t)} className="flex items-center gap-3"><span className="glass-dark grid h-10 w-10 place-items-center rounded-xl"><Icon className="h-5 w-5" /></span>{String(t)}</li>;
            })}
          </ul>
        </div>
      </aside>

      <main id="conteudo" className="flex flex-col px-5 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Link href="/" className="lg:hidden"><Logo /></Link>
          <Link href="/" className="ml-auto inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Voltar ao site</Link>
        </div>
        <div className="mx-auto my-auto w-full max-w-md py-12">
          <ol className="mb-10 flex gap-2" aria-label="Passos">
            {steps.map(([k, l], i) => (
              <li key={k} aria-current={i === idx ? "step" : undefined} className="flex-1">
                <span className={`block h-1 rounded-full ${i <= idx ? "bg-ink" : "bg-line"}`} />
                <span className={`mt-2 block text-xs font-semibold ${i <= idx ? "text-ink" : "text-muted"}`}>{l}</span>
              </li>
            ))}
          </ol>

          <h1 className="text-3xl font-bold sm:text-4xl">
            {step === "password" ? "Portal da instituição" : step === "setup" ? "Proteja a sua conta" : step === "mfa" ? "Confirme que é você" : "Escolha onde entrar"}
          </h1>
          <p className="mt-2 text-muted">
            {step === "password" ? "Acesso para as equipas das instituições aderentes." : step === "setup" ? "Configure uma app autenticadora. Só precisa de fazer isto uma vez." : step === "mfa" ? "Introduza o código de 6 dígitos da sua app autenticadora." : "A sua conta tem acesso a mais de um espaço."}
          </p>

          <div className="mt-8">
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
              </>
            )}

            {(step === "mfa" || step === "setup") && (
              <form onSubmit={verify} className="space-y-5" noValidate>
                {step === "setup" ? (
                  <div className="rounded-3xl bg-white p-5 ring-1 ring-line">
                    <div className="flex items-center gap-3 text-sm font-semibold"><Smartphone className="h-5 w-5" /> Google Authenticator, Microsoft Authenticator, Aegis…</div>
                    <p className="mt-3 text-sm text-muted">Adicione uma conta com esta chave:</p>
                    <p className="mt-2 break-all rounded-2xl bg-canvas p-3 font-mono text-base tracking-wider">{secret}</p>
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
          </div>
        </div>
      </main>
    </div>
  );
}
