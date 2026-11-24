"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Field, Row } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api, csrfToken, errorMessage, fieldErrors, newIdempotencyKey, type Service } from "@/lib/api";
import { formatMZN, isValidPhone, METHOD_LABEL, normalizePhone } from "@/lib/i18n";

type Breakdown = { amount: number; commission: number; total: number; commission_payer: string };
type Confirmed = Breakdown & { quote?: string; request?: string; holder?: string; description?: string };
type Step = "dados" | "confirmar" | "metodo";

const WALLETS = ["mpesa", "emola", "mkesh"];
const STEPS: [Step, string][] = [
  ["dados", "Dados"],
  ["confirmar", "Valor"],
  ["metodo", "Pagamento"],
];

export function PayFlow({
  service: s,
  prefill,
  scenarios,
}: {
  service: Service;
  prefill: Record<string, string>;
  scenarios: Record<string, string>;
}) {
  const router = useRouter();
  const textFields = s.fields.filter((f) => f.type !== "file");
  const fileFields = s.fields.filter((f) => f.type === "file");

  const [step, setStep] = useState<Step>("dados");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(textFields.map((f) => [f.name, prefill[f.name] ?? ""])),
  );
  const [amountMt, setAmountMt] = useState(prefill.valor ?? "");
  const [files, setFiles] = useState<Record<string, File>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  const [method, setMethod] = useState("mpesa");
  const [phone, setPhone] = useState("");
  const [scenario, setScenario] = useState("sucesso");
  const [note, setNote] = useState("");
  const idemKey = useRef<string>("");
  // Até o JS hidratar, o formulário faria um envio nativo e perderia o fluxo.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  // Pagar um pedido já criado (link partilhado ?pedido=PED…)
  const existingRequest = prefill.pedido && /^PED[0-9A-Z]{10}$/.test(prefill.pedido) ? prefill.pedido : "";
  useEffect(() => {
    if (!existingRequest) return;
    api.POST("/api/catalog/services/{id}/price", { params: { path: { id: s.id } }, body: {} }).then((r) => {
      if (r.data) {
        setConfirmed({ ...r.data, request: existingRequest, description: `Pedido ${existingRequest}` });
        setStep("confirmar");
      } else setError(errorMessage(r.error));
    });
  }, [existingRequest, s.id]);

  async function submitData(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setErrors({});
    const errs: Record<string, string> = {};
    for (const f of textFields) {
      const v = (values[f.name] ?? "").trim();
      if (f.required && !v) errs[f.name] = "Obrigatório.";
      else if (v && f.pattern && !new RegExp(f.pattern).test(v)) errs[f.name] = "Formato inválido.";
    }
    for (const f of fileFields) if (f.required && !files[f.name]) errs[f.name] = "Anexe o documento.";
    const cents = Math.round(Number(amountMt.replace(",", ".")) * 100);
    if (s.pricing === "aberto" && !(cents > 0)) errs.valor = "Indique o valor.";
    if (Object.keys(errs).length) return setErrors(errs);

    setBusy(true);
    try {
      if (s.pricing === "consulta") {
        const r = await api.POST("/api/catalog/services/{id}/quote", {
          params: { path: { id: s.id } },
          body: { fields: values },
        });
        if (!r.data) return void (setErrors(fieldErrors(r.error)), setError(errorMessage(r.error)));
        setConfirmed({ ...r.data, quote: r.data.id });
      } else if (s.integration_level === 3) {
        const fd = new FormData();
        fd.set("service", String(s.id));
        fd.set("fields", JSON.stringify(values));
        for (const [k, f] of Object.entries(files)) fd.set(k, f);
        const res = await fetch("/api/requests", { method: "POST", body: fd, headers: { "X-CSRFToken": csrfToken() } });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return void (setErrors(fieldErrors(body)), setError(errorMessage(body)));
        const p = await api.POST("/api/catalog/services/{id}/price", { params: { path: { id: s.id } }, body: {} });
        if (!p.data) return setError(errorMessage(p.error));
        setConfirmed({ ...p.data, request: body.code, description: `Pedido ${body.code}` });
      } else {
        const p = await api.POST("/api/catalog/services/{id}/price", {
          params: { path: { id: s.id } },
          body: s.pricing === "aberto" ? { amount: cents } : {},
        });
        if (!p.data) return setError(errorMessage(p.error));
        setConfirmed({ ...p.data, description: s.name });
      }
      setStep("confirmar");
    } catch {
      setError("Sem ligação. Verifique a internet e tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmed) return;
    if (WALLETS.includes(method) && !isValidPhone(phone)) return setErrors({ phone: "Número inválido (ex.: 84 123 4567)." });
    setErrors({});
    setError("");
    setBusy(true);
    idemKey.current ||= newIdempotencyKey(); // repetir o clique não cria segundo pagamento
    try {
      const r = await api.POST("/api/payments", {
        params: { header: { "Idempotency-Key": idemKey.current } },
        body: {
          service: s.id,
          method: method as never,
          fields: values,
          amount: s.pricing === "aberto" ? confirmed.amount : undefined,
          quote: confirmed.quote,
          request: confirmed.request,
          payer_phone: WALLETS.includes(method) ? normalizePhone(phone) : undefined,
          scenario: Object.keys(scenarios).length ? (scenario as never) : undefined,
        },
      });
      if (!r.data) {
        idemKey.current = "";
        return setError(errorMessage(r.error));
      }
      router.push(`/pagamento/${r.data.reference}`);
    } catch {
      setError("Sem ligação. O pagamento não foi enviado; tente de novo.");
      setBusy(false);
    }
  }

  function shareLink() {
    const q = new URLSearchParams(confirmed?.request ? { pedido: confirmed.request } : values);
    if (s.pricing === "aberto" && amountMt) q.set("valor", amountMt);
    const url = `${location.origin}/servicos/${s.id}?${q}`;
    const text = `Pode pagar por mim? ${s.name} (${s.institution.name})`;
    if (navigator.share) navigator.share({ title: "PagaMOZ", text, url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => setNote("Link copiado. Envie-o por WhatsApp ou SMS."));
  }

  async function saveToWallet() {
    const r = await api.POST("/api/me/obligations", {
      body: { service: s.id, label: s.name.slice(0, 60), fields: values },
    });
    setNote(r.response.status === 403 ? "Entre na sua conta para guardar." : r.data ? "Guardado na sua carteira." : errorMessage(r.error));
  }

  const idx = STEPS.findIndex(([k]) => k === step);

  return (
    <div>
      <ol className="mb-5 flex gap-2" aria-label="Passos">
        {STEPS.map(([k, label], i) => (
          <li key={k} aria-current={k === step ? "step" : undefined}
            className={`flex-1 border-t-4 pt-2 text-sm font-medium ${i <= idx ? "border-brand-600 text-brand-800" : "border-line text-muted"}`}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {error ? <div className="mb-4"><Alert>{error}</Alert></div> : null}

      {step === "dados" && (
        <Card>
          <form onSubmit={submitData} noValidate className="space-y-4">
            {textFields.map((f) => (
              <Field key={f.name} id={f.name} label={f.label} required={f.required} error={errors[f.name]}
                type={f.type === "date" ? "date" : f.type === "phone" ? "tel" : "text"}
                inputMode={f.pattern?.startsWith("^\\d") ? "numeric" : undefined}
                value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
            ))}
            {s.pricing === "aberto" && (
              <Field id="valor" label="Valor a pagar (MT)" inputMode="decimal" error={errors.valor}
                hint={s.min_amount ? `Mínimo ${formatMZN(s.min_amount)}` : undefined}
                value={amountMt} onChange={(e) => setAmountMt(e.target.value)} />
            )}
            {fileFields.map((f) => (
              <div key={f.name}>
                <label htmlFor={f.name} className="block text-sm font-medium text-ink/80">{f.label}</label>
                <input id={f.name} type="file" accept="application/pdf,image/jpeg,image/png"
                  aria-describedby={`${f.name}-hint`}
                  className="mt-1 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-brand-50 file:px-4 file:font-semibold file:text-brand-800"
                  onChange={(e) => e.target.files?.[0] && setFiles({ ...files, [f.name]: e.target.files[0] })} />
                <p id={`${f.name}-hint`} className={`mt-1 text-sm ${errors[f.name] ? "text-accent" : "text-muted"}`}>
                  {errors[f.name] ?? "PDF, JPG ou PNG até 5 MB."}
                </p>
              </div>
            ))}
            <Button type="submit" disabled={busy || !ready} className="w-full">
              {busy ? "A consultar…" : s.pricing === "consulta" ? "Consultar valor" : "Continuar"}
            </Button>
          </form>
        </Card>
      )}

      {step === "confirmar" && confirmed && (
        <Card>
          <h2 className="text-lg font-bold">Confirme o valor</h2>
          {confirmed.description ? <p className="mt-1 text-muted">{confirmed.description}</p> : null}
          {confirmed.holder ? <p className="mt-1 text-sm text-muted">Titular: <strong>{confirmed.holder}</strong></p> : null}
          <dl className="mt-4 divide-y divide-line">
            <Row label="Valor do serviço">{formatMZN(confirmed.amount)}</Row>
            {confirmed.commission_payer === "cidadao" ? (
              <Row label="Taxa de serviço">{formatMZN(confirmed.commission)}</Row>
            ) : null}
            <Row label="Total a pagar" strong>{formatMZN(confirmed.total)}</Row>
          </dl>
          {confirmed.commission_payer !== "cidadao" ? (
            <p className="mt-2 text-sm text-muted">Sem taxas para si: a comissão é suportada pela instituição.</p>
          ) : null}
          <div className="mt-5 grid gap-2">
            <Button onClick={() => setStep("metodo")}>Continuar para pagamento</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={shareLink}><Icon name="share" className="h-5 w-5" />Pedir a alguém</Button>
              {!confirmed.request ? (
                <Button variant="secondary" onClick={saveToWallet}>Guardar</Button>
              ) : <span />}
            </div>
            {!existingRequest && !confirmed.request ? (
              <button className="min-h-11 text-sm font-medium text-muted underline-offset-2 hover:underline" onClick={() => setStep("dados")}>
                Alterar dados
              </button>
            ) : null}
            {note ? <p role="status" className="text-center text-sm text-brand-800">{note}</p> : null}
          </div>
        </Card>
      )}

      {step === "metodo" && confirmed && (
        <Card>
          <form onSubmit={pay} className="space-y-4">
            <fieldset>
              <legend className="text-lg font-bold">Como quer pagar?</legend>
              <div className="mt-3 grid gap-2">
                {Object.entries(METHOD_LABEL).map(([k, label]) => (
                  <label key={k} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-4 ring-1 ring-inset ${method === k ? "bg-brand-50 ring-2 ring-brand-600" : "ring-line"}`}>
                    <input type="radio" name="method" value={k} checked={method === k} onChange={() => setMethod(k)} className="h-5 w-5 accent-brand-700" />
                    <span className="font-medium">{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {WALLETS.includes(method) && (
              <Field id="phone" label={`Número ${METHOD_LABEL[method]}`} type="tel" inputMode="tel" autoComplete="tel"
                placeholder="84 123 4567" value={phone} error={errors.phone} onChange={(e) => setPhone(e.target.value)} />
            )}
            {Object.keys(scenarios).length > 0 && (
              <div className="rounded-xl bg-white p-3 ring-1 ring-inset ring-line">
                <label htmlFor="scenario" className="block text-sm font-semibold text-ink">Cenário de demonstração</label>
                <select id="scenario" value={scenario} onChange={(e) => setScenario(e.target.value)}
                  className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-white px-2">
                  {Object.entries(scenarios).map(([k, d]) => <option key={k} value={k}>{k} — {d}</option>)}
                </select>
              </div>
            )}
            <Button type="submit" disabled={busy || !ready} className="w-full">
              {busy ? "A enviar…" : `Pagar ${formatMZN(confirmed.total)}`}
            </Button>
            <button type="button" className="min-h-11 w-full text-sm font-medium text-muted hover:underline" onClick={() => setStep("confirmar")}>
              Voltar
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
