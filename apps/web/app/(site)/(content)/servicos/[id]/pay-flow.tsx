"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Bookmark, CheckCircle2, CircleAlert, ClipboardList, FileCheck2, FlaskConical, Lock, Pencil,
  ReceiptText, Search, Share2, MessageCircle, Users, Upload, UserRound, Wallet,
} from "lucide-react";
import { useCardForm } from "@/components/card-form";
import { BrandMark } from "@/components/brand-mark";
import { MethodIcon, WALLET_PREFIXES } from "@/components/method-icon";
import { useToast } from "@/components/toast";
import { Alert, Button, Card, Field, Row, Toolbar, useDialog } from "@/components/ui";
import { api, csrfToken, errorMessage, fieldErrors, newIdempotencyKey, type Service } from "@/lib/api";
import { formatMZN, isValidPhone, METHOD_LABEL, normalizePhone } from "@/lib/i18n";

type Breakdown = { amount: number; commission: number; total: number; commission_payer: string };
type Item = { titulo: string; referencia: string; detalhe: string; valor: number };
type Confirmed = Breakdown & { quote?: string; request?: string; holder?: string; description?: string; details?: string[][]; items?: Item[] };
type Step = "dados" | "confirmar" | "metodo";

const WALLETS = ["mpesa", "emola", "mkesh"];
const STEP_ICON = { dados: ClipboardList, confirmar: ReceiptText, metodo: Wallet };
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
  const dialog = useDialog();
  const textFields = s.fields.filter((f) => f.type !== "file" && f.type !== "select");
  const selectFields = s.fields.filter((f) => f.type === "select");
  const card = useCardForm();
  const fileFields = s.fields.filter((f) => f.type === "file");

  const [step, setStep] = useState<Step>("dados");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(s.fields.filter((f) => f.type !== "file").map((f) => [f.name, prefill[f.name] ?? (f.type === "select" ? s.variants[0]?.key ?? "" : "")])),
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
  const toast = useToast();
  const [presenter, setPresenter] = useState(false);
  useEffect(() => {
    try {
      setPresenter(sessionStorage.getItem("pagamoz-apresentador") === "1");
    } catch {
      setPresenter(false);
    }
  }, []);
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
      if (s.pricing === "consulta" || (s.lookup && s.pricing === "aberto")) {
        const r = await api.POST("/api/catalog/services/{id}/quote", {
          params: { path: { id: s.id } },
          body: { fields: values, ...(s.pricing === "aberto" ? { amount: cents } : {}) },
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
        const p = await api.POST("/api/catalog/services/{id}/price", {
          params: { path: { id: s.id } },
          body: s.variants.length ? { variant: values.modalidade } : {},
        });
        if (!p.data) return setError(errorMessage(p.error));
        const v = s.variants.find((x) => x.key === values.modalidade);
        setConfirmed({ ...p.data, request: body.code, description: `Pedido ${body.code}${v ? ` · modalidade ${v.label.toLowerCase()}` : ""}` });
      } else {
        const p = await api.POST("/api/catalog/services/{id}/price", {
          params: { path: { id: s.id } },
          body: s.pricing === "aberto" ? { amount: cents } : s.variants.length ? { variant: values.modalidade } : {},
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
    if (WALLETS.includes(method)) {
      const pre = WALLET_PREFIXES[method] ?? [];
      if (!isValidPhone(phone) || !pre.includes(normalizePhone(phone).slice(4, 6)))
        return setErrors({ phone: `Use um número ${METHOD_LABEL[method]} começado por ${pre.join(" ou ")}.` });
    }
    if (method === "cartao") {
      card.touch();
      if (!card.state.valid) return setError("Verifique os dados do cartão.");
    }
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
          amount: s.pricing === "aberto" && !confirmed.quote ? confirmed.amount : undefined,
          split_share: prefill.parte ? Number(prefill.parte) : undefined,
          quote: confirmed.quote,
          request: confirmed.request,
          card: method === "cartao" && card.state.summary ? card.state.summary : undefined,
          payer_phone: WALLETS.includes(method) ? normalizePhone(phone) : undefined,
          scenario: presenter && Object.keys(scenarios).length ? (scenario as never) : undefined,
        },
      });
      if (!r.data) {
        idemKey.current = "";
        return setError(errorMessage(r.error));
      }
      const demo = (r.data as { demo_3ds_code?: string }).demo_3ds_code;
      try {
        if (demo) sessionStorage.setItem(`pagamoz-3ds:${r.data.reference}`, demo);
      } catch {
        /* sem armazenamento: o código de demonstração não aparece */
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
    else navigator.clipboard.writeText(url).then(() => toast("Link copiado. Envie-o por WhatsApp ou SMS."));
  }

  async function saveToWallet() {
    const r = await api.POST("/api/me/obligations", {
      body: { service: s.id, label: s.name.slice(0, 60), fields: values },
    });
    if (r.response.status === 403) toast("Entre na sua conta para guardar.", "info");
    else if (r.data) toast("Guardado na sua carteira.");
    else toast(errorMessage(r.error), "bad");
  }

  const idx = STEPS.findIndex(([k]) => k === step);
  // Saúde dos métodos na última hora: sugere o que está a funcionar (sem trocar o que a pessoa escolheu).
  const [health, setHealth] = useState<Record<string, { state: string; recommended: boolean }>>({});
  const [picked, setPicked] = useState(false);
  useEffect(() => {
    if (step !== "metodo") return;
    fetch("/api/intel/methods").then((r) => r.json()).then((rows: { method: string; state: string; recommended: boolean }[]) => {
      setHealth(Object.fromEntries(rows.map((x) => [x.method, x])));
      const rec = rows.find((x) => x.recommended)?.method;
      if (rec && !picked) setMethod(rec);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  // Dividir: pergunta quantas pessoas e cria a divisão; cada uma paga a sua parte por um link.
  async function splitBill() {
    if (!confirmed) return;
    const n = await dialog.prompt({ title: "Dividir a conta", body: "Entre quantas pessoas (2 a 10)? Cada uma recebe um link para pagar a sua parte.",
      input: { label: "Número de pessoas", placeholder: "Ex.: 3" }, confirm: "Dividir" });
    const parts = Number(n);
    if (!parts || parts < 2 || parts > 10) return n ? setError("Indique entre 2 e 10 pessoas.") : undefined;
    const r = await fetch("/api/splits", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken() },
      body: JSON.stringify({ service: s.id, fields: values, total: confirmed.amount, names: Array(parts).fill("") }) });
    const b = await r.json();
    if (!r.ok) return setError(b.detail ?? "Não foi possível dividir.");
    router.push(`/dividir/${b.code}`);
  }

  const isWallet = WALLETS.includes(method);

  return (
    <div>
      {dialog.ui}
      <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Passos">
        {STEPS.map(([k, label], i) => {
          const I = STEP_ICON[k];
          const done = i < idx;
          return (
            <li key={k} aria-current={k === step ? "step" : undefined}
              className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${i === idx ? "bg-ink text-white" : done ? "bg-white text-ink" : "bg-white/60 text-muted"}`}>
              {done ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <I className="h-4 w-4 shrink-0" />}
              <span className="truncate">{i + 1}. {label}</span>
            </li>
          );
        })}
      </ol>

      {error ? <div className="mb-5"><Alert>{error}</Alert></div> : null}
      {prefill.origem === "fatura" && step === "dados" ? (
        <div className="mb-5 rounded-2xl bg-canvas p-4 text-sm font-semibold">Lemos estes dados da sua fatura. Confirme se estão certos antes de continuar.</div>
      ) : null}

      {step === "dados" && (
        <Card className="animate-rise">
          <form onSubmit={submitData} noValidate className="space-y-5">
            {selectFields.map((f) => (
              <fieldset key={f.name}>
                <legend className="text-sm font-semibold">{f.label}</legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {s.variants.map((v) => (
                    <label key={v.key}
                      className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-4 transition ${values[f.name] === v.key ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40"}`}>
                      <input type="radio" name={f.name} value={v.key} checked={values[f.name] === v.key} className="sr-only"
                        onChange={() => setValues({ ...values, [f.name]: v.key })} />
                      <span>
                        <span className="block font-semibold">{v.label}</span>
                        {v.hint ? <span className={`text-sm ${values[f.name] === v.key ? "text-white/65" : "text-muted"}`}>{v.hint}</span> : null}
                      </span>
                      <span className="shrink-0 font-display font-bold tabular-nums">{formatMZN(v.amount)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            {textFields.map((f) => (
              <Field key={f.name} id={f.name} label={f.label} required={f.required} error={errors[f.name]} hint={f.help}
                type={f.type === "date" ? "date" : f.type === "phone" ? "tel" : "text"}
                inputMode={f.pattern?.startsWith("^\\d") ? "numeric" : undefined}
                value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
            ))}
            {s.pricing === "aberto" && (
              <Field id="valor" label="Valor a pagar (MT)" inputMode="decimal" error={errors.valor}
                hint={s.min_amount ? `Mínimo ${formatMZN(s.min_amount)}` : undefined}
                value={amountMt} onChange={(e) => setAmountMt(e.target.value)} />
            )}
            {s.pricing === "aberto" && (
              <div className="-mt-2 flex flex-wrap gap-2" aria-label="Valores rápidos">
                {[50, 100, 200, 500, 1000].map((v) => (
                  <button key={v} type="button" onClick={() => setAmountMt(String(v))}
                    className={`frame-none min-h-11 rounded-full border px-4 text-sm font-semibold transition ${amountMt === String(v) ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>
                    {v} MT
                  </button>
                ))}
              </div>
            )}
            {fileFields.map((f) => (
              <div key={f.name}>
                <span className="block text-sm font-semibold">{f.label}</span>
                <label htmlFor={f.name}
                  className={`mt-1.5 flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed p-4 transition hover:border-ink ${errors[f.name] ? "border-accent" : files[f.name] ? "border-ink bg-canvas" : "border-ink/20"}`}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-white">
                    {files[f.name] ? <FileCheck2 className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-semibold">{files[f.name]?.name ?? "Escolher ficheiro"}</span>
                    <span id={`${f.name}-hint`} className={errors[f.name] ? "text-accent" : "text-muted"}>{errors[f.name] ?? "PDF, JPG ou PNG até 5 MB."}</span>
                  </span>
                </label>
                <input id={f.name} aria-label={f.label} type="file" accept="application/pdf,image/jpeg,image/png" aria-describedby={`${f.name}-hint`} className="sr-only"
                  onChange={(e) => e.target.files?.[0] && setFiles({ ...files, [f.name]: e.target.files[0] })} />
              </div>
            ))}
            <Button type="submit" disabled={busy || !ready} className="w-full !min-h-12">
              {s.lookup ? <Search className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              {busy ? "A consultar…" : s.pricing === "consulta" ? "Consultar valor" : s.lookup ? "Verificar e continuar" : "Continuar"}
            </Button>
          </form>
        </Card>
      )}

      {step === "confirmar" && confirmed && (
        <Card className="animate-rise">
          <h2 className="text-2xl font-bold">Confirme o valor</h2>
          {confirmed.description ? <p className="mt-1 text-muted">{confirmed.description}</p> : null}
          <div className="mt-6 rounded-3xl border border-dashed border-ink/20 bg-canvas/70 p-5">
            {confirmed.holder ? (
              <p className="flex items-center gap-2 text-sm"><UserRound className="h-4 w-4 text-muted" /> Titular: <strong>{confirmed.holder}</strong></p>
            ) : null}
            {confirmed.details?.length ? (
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 rounded-2xl bg-white p-4 text-sm sm:grid-cols-2">
                {confirmed.details.map(([k, v]) => (
                  <div key={k} className={k === "Aviso" ? "sm:col-span-2" : ""}>
                    <dt className="text-xs text-muted">{k}</dt>
                    <dd className={`font-semibold ${k === "Aviso" ? "flex items-center gap-1.5 text-accent" : ""}`}>
                      {k === "Aviso" ? <CircleAlert className="h-4 w-4 shrink-0" /> : null}{v}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {confirmed.items?.length ? (
              <ul className="mt-3 divide-y divide-line rounded-2xl bg-white">
                {confirmed.items.map((it) => (
                  <li key={it.referencia} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-canvas"><ReceiptText className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{it.titulo}</span>
                      <span className="block truncate text-xs text-muted">{it.referencia} · {it.detalhe}</span>
                    </span>
                    <span className="shrink-0 font-display font-bold tabular-nums">{formatMZN(it.valor)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <dl className="mt-2 divide-y divide-line">
              <Row label="Valor do serviço">{formatMZN(confirmed.amount)}</Row>
              {confirmed.commission_payer === "cidadao" ? <Row label="Taxa de serviço">{formatMZN(confirmed.commission)}</Row> : null}
              <Row label="Total a pagar" strong>{formatMZN(confirmed.total)}</Row>
            </dl>
          </div>
          {confirmed.commission_payer !== "cidadao" ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted"><BadgeCheck className="h-4 w-4" /> Sem taxas para si: a comissão é suportada pela instituição.</p>
          ) : null}
          <div className="mt-6 space-y-4">
            <Button onClick={() => setStep("metodo")} className="w-full !min-h-12">Continuar para pagamento <ArrowRight className="h-4 w-4" /></Button>
            {s.pricing === "aberto" && !prefill.parte ? (
              <Button variant="ghost" className="w-full !min-h-11 text-sm" onClick={splitBill}><Users className="h-4 w-4" /> Dividir com outras pessoas</Button>
            ) : null}
            <Toolbar className="flex w-full flex-wrap justify-center">
              <Button variant="ghost" className="!min-h-10 text-sm" onClick={shareLink}><Share2 className="h-4 w-4" /> Pedir a alguém</Button>
              {!confirmed.request ? <Button variant="ghost" className="!min-h-10 text-sm" onClick={saveToWallet}><Bookmark className="h-4 w-4" /> Guardar</Button> : null}
              {!existingRequest && !confirmed.request ? (
                <Button variant="ghost" className="!min-h-10 text-sm" onClick={() => setStep("dados")}><Pencil className="h-4 w-4" /> Alterar dados</Button>
              ) : null}
            </Toolbar>
          </div>
        </Card>
      )}

      {step === "metodo" && confirmed && (
        <Card className="animate-rise">
          <form onSubmit={pay} className="space-y-6">
            <fieldset>
              <legend className="text-2xl font-bold">Como quer pagar?</legend>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(METHOD_LABEL).map(([k, label]) => (
                  <label key={k}
                    className={`relative flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 transition ${method === k ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40"}`}>
                    <input type="radio" name="method" value={k} checked={method === k} onChange={() => { setMethod(k); setPicked(true); }} className="sr-only" />
                    {WALLET_PREFIXES[k] ? <BrandMark slug={k} name={label} size={44} /> : k === "cartao" ? <span className="flex gap-1.5"><BrandMark slug="visa" name="Visa" size={44} /><BrandMark slug="mastercard" name="Mastercard" size={44} /></span> : <MethodIcon method={k} className={method === k ? "!bg-white/15 !text-white" : ""} />}
                    <span className="text-sm font-semibold leading-tight">{label}</span>
                    {health[k]?.recommended ? (
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${method === k ? "text-white" : "text-emerald-700"}`}><MessageCircle className="h-3 w-3" /> A funcionar bem agora</span>
                    ) : health[k] && ["instavel", "falhas"].includes(health[k].state) ? (
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${method === k ? "text-white" : "text-amber-700"}`}><AlertTriangle className="h-3 w-3" /> {health[k].state === "falhas" ? "Com falhas agora" : "Instável agora"}</span>
                    ) : null}
                    {method === k ? <CheckCircle2 className="absolute right-3 top-3 h-4 w-4" /> : null}
                  </label>
                ))}
              </div>
            </fieldset>
            {method === "cartao" ? card.ui : null}
            {isWallet && (
              <Field id="phone" label={`Número ${METHOD_LABEL[method]}`} type="tel" inputMode="tel" autoComplete="tel"
                placeholder={`${WALLET_PREFIXES[method]?.[0] ?? "84"} 123 4567`} hint={`Números ${WALLET_PREFIXES[method]?.join(" ou ")}`} value={phone} error={errors.phone} onChange={(e) => setPhone(e.target.value)} />
            )}
            {presenter && Object.keys(scenarios).length > 0 && (
              <div className="glass rounded-2xl p-4">
                <label htmlFor="scenario" className="flex items-center gap-2 text-sm font-semibold"><FlaskConical className="h-4 w-4 text-accent" /> Cenário de demonstração (modo apresentador)</label>
                <select id="scenario" value={scenario} onChange={(e) => setScenario(e.target.value)}
                  className="mt-2 block min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm">
                  {Object.entries(scenarios).map(([k, d]) => <option key={k} value={k}>{k}: {d}</option>)}
                </select>
              </div>
            )}
            <Button type="submit" disabled={busy || !ready} className="w-full !min-h-14 text-base">
              <Lock className="h-4 w-4" /> {busy ? "A enviar…" : `Pagar ${formatMZN(confirmed.total)}`}
            </Button>
            <Toolbar className="flex w-full justify-center">
              <Button type="button" variant="ghost" className="!min-h-10 text-sm" onClick={() => setStep("confirmar")}><ArrowLeft className="h-4 w-4" /> Voltar</Button>
            </Toolbar>
          </form>
        </Card>
      )}
    </div>
  );
}
