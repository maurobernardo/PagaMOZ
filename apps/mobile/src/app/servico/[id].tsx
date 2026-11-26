import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, FileCheck2, Info, Lock, Search, Upload } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { BrandMark, MethodMark } from "../../components/brand";
import { Alert, Button, Card, Field, H2, Header, Loading, P, Row, Steps } from "../../components/ui";
import { t } from "../../lib/i18n";
import { api, ApiError, errorMessage, fieldErrors, newKey, type Payment, type Schemas, type Service } from "../../lib/api";
import { cardSummary, formatCardNumber, formatExp } from "../../lib/card";
import { formatMZN, isValidPhone, METHOD_LABEL, normalizePhone, WALLET_PREFIXES } from "../../lib/format";
import { demo3ds } from "../../lib/session";
import { C, F, R } from "../../theme";

type Confirmed = {
  amount: number; commission: number; total: number; description: string; commission_payer?: string;
  quote?: string; request?: string; holder?: string;
  details?: [string, string][]; items?: { titulo: string; referencia: string; detalhe: string; valor: number }[];
};
type Picked = { uri: string; name: string; mimeType: string };
const STEPS = () => [t("Dados"), t("Confirmar"), t("Pagar")];
const WALLETS = Object.keys(WALLET_PREFIXES);

export default function Servico() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [s, setS] = useState<Service | null>(null);
  const [loadErr, setLoadErr] = useState("");
  useEffect(() => {
    api<Service>(`/api/catalog/services/${id}`).then(setS).catch((e) => setLoadErr(errorMessage(e)));
  }, [id]);
  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <Header title={s?.group?.option ?? ""} />
      {loadErr ? <View style={{ padding: 16 }}><Alert>{loadErr}</Alert></View> : !s ? <Loading /> : <PayFlow s={s} />}
    </View>
  );
}

function PayFlow({ s }: { s: Service }) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(s.fields.filter((f) => f.type !== "file").map((f) => [f.name, f.type === "select" ? s.variants[0]?.key ?? "" : ""])));
  const [files, setFiles] = useState<Record<string, Picked>>({});
  const [amountMt, setAmountMt] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  const [method, setMethod] = useState("mpesa");
  const [phone, setPhone] = useState("");
  const [card, setCard] = useState({ number: "", exp: "", cvv: "", holder: "" });
  const idem = useRef("");
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const go = (n: number) => {
    setStep(n);
    setError("");
    scroll.current?.scrollTo({ y: 0, animated: true });
  };

  async function submitData() {
    const errs: Record<string, string> = {};
    for (const f of s.fields) {
      if (f.type === "file") {
        if (f.required && !files[f.name]) errs[f.name] = "Escolha o ficheiro.";
      } else if (f.type !== "select") {
        const v = (values[f.name] ?? "").trim();
        if (f.required && !v) errs[f.name] = t("Preencha este campo.");
        else if (v && f.pattern && !new RegExp(f.pattern).test(f.type === "phone" ? v.replace(/\D/g, "").slice(-9) : v)) errs[f.name] = t("Verifique o que escreveu.");
      }
    }
    const cents = Math.round(Number(amountMt.replace(",", ".")) * 100);
    if (s.pricing === "aberto" && !(cents > 0)) errs.valor = t("Indique o valor.");
    setErrors(errs);
    if (Object.keys(errs).length) return setError(t("Corrija os campos assinalados."));

    setBusy(true);
    setError("");
    const fields = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, s.fields.find((f) => f.name === k)?.type === "phone" ? v.replace(/\D/g, "").slice(-9) : v.trim()]));
    try {
      if (s.pricing === "consulta" || s.lookup) {
        const q = await api<Schemas["QuoteResponse"]>(`/api/catalog/services/${s.id}/quote`, { body: { fields, ...(s.pricing === "aberto" ? { amount: cents } : {}) } });
        setConfirmed({ ...q, description: q.description, quote: q.id, holder: q.holder ?? undefined, details: q.details as [string, string][], items: q.items as Confirmed["items"] });
      } else if (s.integration_level === 3) {
        const fd = new FormData();
        fd.append("service", String(s.id));
        fd.append("fields", JSON.stringify(fields));
        for (const [k, f] of Object.entries(files)) fd.append(k, { uri: f.uri, name: f.name, type: f.mimeType } as unknown as Blob);
        const req = await api<{ code: string }>("/api/requests", { form: fd });
        const p = await api<Schemas["PriceResponse"]>(`/api/catalog/services/${s.id}/price`, { body: s.variants.length ? { variant: fields.modalidade } : {} });
        const v = s.variants.find((x) => x.key === fields.modalidade);
        setConfirmed({ ...p, request: req.code, description: `Pedido ${req.code}${v ? ` · modalidade ${v.label.toLowerCase()}` : ""}` });
      } else {
        const p = await api<Schemas["PriceResponse"]>(`/api/catalog/services/${s.id}/price`, {
          body: s.pricing === "aberto" ? { amount: cents } : s.variants.length ? { variant: fields.modalidade } : {},
        });
        setConfirmed({ ...p, description: s.name });
      }
      go(1);
    } catch (e) {
      setErrors(fieldErrors(e));
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!confirmed) return;
    let cardBody;
    if (WALLETS.includes(method)) {
      const pre = WALLET_PREFIXES[method];
      if (!isValidPhone(phone) || !pre.includes(normalizePhone(phone).slice(4, 6)))
        return setErrors({ phone: `Use um número ${METHOD_LABEL[method]} começado por ${pre.join(" ou ")}.` });
    }
    if (method === "cartao") {
      const c = cardSummary(card.number, card.exp, card.cvv, card.holder);
      if (!c.summary) return setErrors(c.errors);
      cardBody = c.summary;
    }
    setErrors({});
    setBusy(true);
    setError("");
    idem.current ||= newKey();
    try {
      const r = await api<Payment & { demo_3ds_code?: string }>("/api/payments", {
        headers: { "Idempotency-Key": idem.current },
        body: {
          service: s.id, method, fields: values,
          amount: s.pricing === "aberto" && !confirmed.quote ? confirmed.amount : undefined,
          quote: confirmed.quote, request: confirmed.request, card: cardBody,
          payer_phone: WALLETS.includes(method) ? normalizePhone(phone) : undefined,
        },
      });
      if (r.demo_3ds_code) demo3ds.set(r.reference, r.demo_3ds_code);
      router.replace(`/pagamento/${r.reference}`);
    } catch (e) {
      if (!(e instanceof ApiError)) setError("Sem ligação. O pagamento não foi enviado; tente de novo.");
      else {
        idem.current = "";
        setError(errorMessage(e));
      }
      setBusy(false);
    }
  }

  const selectFields = s.fields.filter((f) => f.type === "select");
  const textFields = s.fields.filter((f) => !["select", "file"].includes(f.type));
  const fileFields = s.fields.filter((f) => f.type === "file");

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: C.hero, borderRadius: 28, padding: 20, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <BrandMark slug={s.institution.slug} name={s.institution.name} size={52} />
            <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }} numberOfLines={2}>{s.institution.name}</Text>
          </View>
          <Text style={{ fontFamily: F.display, fontSize: 26, lineHeight: 31, letterSpacing: -0.6, color: C.onHero }}>{s.name}</Text>
          {s.guide?.length ? (
            <View style={{ gap: 6 }}>
              {s.guide.map((g) => (
                <View key={g} style={{ flexDirection: "row", gap: 8 }}>
                  <Info size={16} color={C.accent} style={{ marginTop: 2 }} />
                  <Text style={{ flex: 1, fontFamily: F.body, fontSize: 14, lineHeight: 20, color: "rgba(255,255,255,0.75)" }}>{g}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <Steps steps={STEPS()} current={step} />
        {error ? <Alert>{error}</Alert> : null}

        {step === 0 && (
          <Card style={{ gap: 18 }}>
            {selectFields.map((f) => (
              <View key={f.name} style={{ gap: 8 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 14 }}>{f.label}</Text>
                {s.variants.map((v) => {
                  const on = values[f.name] === v.key;
                  return (
                    <Pressable key={v.key} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setValues({ ...values, [f.name]: v.key })}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 20, borderWidth: 1.5, borderColor: on ? C.ink : C.line, backgroundColor: on ? C.ink : C.white }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: F.bold, fontSize: 16, color: on ? C.white : C.ink }}>{v.label}</Text>
                        {v.hint ? <Text style={{ fontFamily: F.body, fontSize: 13, color: on ? "rgba(255,255,255,0.65)" : C.muted }}>{v.hint}</Text> : null}
                      </View>
                      <Text style={{ fontFamily: F.display, fontSize: 16, color: on ? C.white : C.ink }}>{formatMZN(v.amount)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            {textFields.map((f) => (
              <Field key={f.name} label={f.label} hint={f.help} error={errors[f.name]} value={values[f.name] ?? ""}
                onChangeText={(v) => setValues({ ...values, [f.name]: v })}
                keyboardType={f.type === "phone" ? "phone-pad" : f.pattern?.startsWith("^\\d") ? "number-pad" : "default"}
                placeholder={f.type === "date" ? "AAAA-MM-DD" : undefined} autoCapitalize={f.name === "matricula" ? "characters" : "sentences"} />
            ))}
            {s.pricing === "aberto" && (
              <View style={{ gap: 10 }}>
                <Field label={t("Valor a pagar (MT)")} keyboardType="decimal-pad" value={amountMt} onChangeText={setAmountMt} error={errors.valor}
                  hint={s.min_amount ? `Mínimo ${formatMZN(s.min_amount)}` : undefined} />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {[50, 100, 200, 500, 1000].map((v) => {
                    const on = amountMt === String(v);
                    return (
                      <Pressable key={v} accessibilityRole="button" onPress={() => setAmountMt(String(v))}
                        style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: "center", borderRadius: R.pill, borderWidth: 1.5, borderColor: on ? C.ink : C.line, backgroundColor: on ? C.ink : C.white }}>
                        <Text style={{ fontFamily: F.bold, fontSize: 15, color: on ? C.white : C.ink }}>{v} MT</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            {fileFields.map((f) => (
              <Pressable key={f.name} accessibilityRole="button" accessibilityLabel={f.label}
                onPress={async () => {
                  const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png"], copyToCacheDirectory: true });
                  const a = r.assets?.[0];
                  if (!r.canceled && a) {
                    if ((a.size ?? 0) > 5 * 1024 * 1024) return setErrors({ ...errors, [f.name]: "O ficheiro passa de 5 MB." });
                    setFiles({ ...files, [f.name]: { uri: a.uri, name: a.name, mimeType: a.mimeType ?? "application/pdf" } });
                  }
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 20, borderWidth: 1.5, borderStyle: "dashed", borderColor: errors[f.name] ? C.accent : files[f.name] ? C.ink : "#cfcec8" }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
                  {files[f.name] ? <FileCheck2 size={20} color={C.white} /> : <Upload size={20} color={C.white} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 15 }} numberOfLines={1}>{files[f.name]?.name ?? f.label}</Text>
                  <Text style={{ fontFamily: F.body, fontSize: 13, color: errors[f.name] ? C.accent : C.muted }}>{errors[f.name] ?? "PDF, JPG ou PNG até 5 MB. Toque para escolher."}</Text>
                </View>
              </Pressable>
            ))}
            <Button onPress={submitData} busy={busy} icon={s.lookup || s.pricing === "consulta" ? Search : ArrowRight}>
              {t(s.pricing === "consulta" ? "Consultar valor" : s.lookup ? "Verificar e continuar" : "Continuar")}
            </Button>
          </Card>
        )}

        {step === 1 && confirmed && (
          <Card style={{ gap: 14 }}>
            <H2>{t("Confirme o valor")}</H2>
            <P muted>{confirmed.description}</P>
            {confirmed.holder ? <Row label={t("Titular")} value={confirmed.holder} /> : null}
            {confirmed.details?.map(([l, v]) => <Row key={l} label={l} value={v} />)}
            {confirmed.items?.length ? (
              <View style={{ borderRadius: 20, borderWidth: 1, borderColor: C.line, overflow: "hidden" }}>
                {confirmed.items.map((it, i) => (
                  <View key={it.referencia} style={{ flexDirection: "row", gap: 10, padding: 14, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: F.bold, fontSize: 14 }}>{it.titulo}</Text>
                      <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>{it.referencia} · {it.detalhe}</Text>
                    </View>
                    <Text style={{ fontFamily: F.semi, fontSize: 14 }}>{formatMZN(it.valor)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Row label={t("Valor")} value={formatMZN(confirmed.amount)} />
            <Row label={t("Comissão")} value={!confirmed.commission || confirmed.commission_payer === "instituicao" ? t("Paga pela instituição") : formatMZN(confirmed.commission)} />
            <Row label={t("Total a pagar")} value={formatMZN(confirmed.total)} strong />
            <Button onPress={() => go(2)} icon={ArrowRight}>{t("Continuar para pagamento")}</Button>
            <Button variant="ghost" onPress={() => go(0)} icon={ArrowLeft}>{t("Alterar dados")}</Button>
          </Card>
        )}

        {step === 2 && confirmed && (
          <Card style={{ gap: 16 }}>
            <H2>{t("Como quer pagar?")}</H2>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(METHOD_LABEL).map(([k, label]) => {
                const on = method === k;
                return (
                  <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label}
                    onPress={() => { setMethod(k); setErrors({}); }}
                    style={{ width: "48%", flexGrow: 1, minHeight: 108, padding: 14, gap: 10, borderRadius: 22, borderWidth: 1.5, borderColor: on ? C.ink : C.line, backgroundColor: on ? C.ink : C.white }}>
                    <MethodMark method={k} size={40} active={on} />
                    <Text style={{ fontFamily: F.bold, fontSize: 14, lineHeight: 18, color: on ? C.white : C.ink }}>{label}</Text>
                    {on ? <CheckCircle2 size={18} color={C.white} style={{ position: "absolute", right: 12, top: 12 }} /> : null}
                  </Pressable>
                );
              })}
            </View>

            {WALLETS.includes(method) && (
              <Field label={`Número ${METHOD_LABEL[method]}`} keyboardType="phone-pad" value={phone} onChangeText={setPhone} error={errors.phone}
                placeholder={`${WALLET_PREFIXES[method][0]} 123 4567`} hint={`Números ${WALLET_PREFIXES[method].join(" ou ")}. Vai receber um pedido de PIN no telemóvel.`} />
            )}
            {method === "cartao" && (
              <View style={{ gap: 14 }}>
                <View style={{ backgroundColor: C.hero, borderRadius: 22, padding: 18, gap: 18 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <CreditCard size={26} color={C.onHero} />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Lock size={14} color="rgba(255,255,255,0.6)" /><Text style={{ fontFamily: F.semi, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Cifrado</Text></View>
                  </View>
                  <Text style={{ fontFamily: "monospace", fontSize: 20, letterSpacing: 2, color: C.onHero }}>{formatCardNumber(card.number) || "•••• •••• •••• ••••"}</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontFamily: F.semi, fontSize: 13, color: "rgba(255,255,255,0.8)" }} numberOfLines={1}>{card.holder.toUpperCase() || "NOME NO CARTÃO"}</Text>
                    <Text style={{ fontFamily: F.semi, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{card.exp || "MM/AA"}</Text>
                  </View>
                </View>
                <Field label={t("Número do cartão")} keyboardType="number-pad" value={formatCardNumber(card.number)} onChangeText={(v) => setCard({ ...card, number: v })} error={errors.number} autoComplete="cc-number" mono />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}><Field label={t("Validade")} keyboardType="number-pad" placeholder="MM/AA" value={card.exp} onChangeText={(v) => setCard({ ...card, exp: formatExp(v) })} error={errors.exp} autoComplete="cc-exp" /></View>
                  <View style={{ flex: 1 }}><Field label="CVV" keyboardType="number-pad" secureTextEntry maxLength={3} value={card.cvv} onChangeText={(v) => setCard({ ...card, cvv: v.replace(/\D/g, "") })} error={errors.cvv} autoComplete="cc-csc" /></View>
                </View>
                <Field label={t("Nome no cartão")} autoCapitalize="characters" value={card.holder} onChangeText={(v) => setCard({ ...card, holder: v })} error={errors.holder} autoComplete="cc-name" />
                <P muted size={13}>{t("O número completo e o CVV não saem do seu telemóvel. O seu banco pode pedir um código de confirmação.")}</P>
              </View>
            )}
            {method === "referencia_bancaria" && <Alert tone="info">Depois de continuar recebe a entidade e a referência para pagar no balcão, ATM ou banca online.</Alert>}
            {method === "qr" && <Alert tone="info">Depois de continuar aparece o código QR para ler com a app do banco ou da carteira.</Alert>}

            <Button onPress={pay} busy={busy} icon={Lock}>{`${t("Pagar")} ${formatMZN(confirmed.total)}`}</Button>
            <Button variant="ghost" onPress={() => go(1)} icon={ArrowLeft}>{t("Voltar")}</Button>
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
