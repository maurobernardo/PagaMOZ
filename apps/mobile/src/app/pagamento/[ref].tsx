import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { CheckCircle2, Clock3, Copy, Download, KeyRound, RotateCcw, ShieldCheck, XCircle } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { MethodMark } from "../../components/brand";
import { Alert, Button, Card, Field, H1, H2, Loading, P, Row } from "../../components/ui";
import { API, api, errorMessage, type Payment } from "../../lib/api";
import { formatDateTime, formatMZN, METHOD_LABEL, PAYMENT_STATUS } from "../../lib/format";
import { demo3ds } from "../../lib/session";
import { C, F } from "../../theme";

const WAITING = ["CRIADA", "PENDENTE"];

export default function Pagamento() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const [p, setP] = useState<Payment | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState("");
  const was = useRef<string>("");

  const load = useCallback(async () => {
    try {
      const np = await api<Payment>(`/api/payments/${ref}`);
      if (was.current && WAITING.includes(was.current) && !WAITING.includes(np.status))
        Haptics.notificationAsync(["CONFIRMADA", "LIQUIDADA"].includes(np.status) ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
      was.current = np.status;
      setP(np);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [ref]);

  useEffect(() => {
    load();
  }, [load]);
  // Enquanto espera, pergunta à API a cada 3 s (a confirmação chega do provedor).
  useEffect(() => {
    if (!p || !WAITING.includes(p.status)) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [p, load]);

  if (!p) return error ? <View style={{ padding: 16 }}><Alert>{error}</Alert></View> : <Loading />;

  const waiting = WAITING.includes(p.status);
  const ok = ["CONFIRMADA", "LIQUIDADA"].includes(p.status);
  const st = PAYMENT_STATUS[p.status] ?? { label: p.status, tone: "info" };
  const Icon = ok ? CheckCircle2 : waiting ? Clock3 : XCircle;
  const copy = (v: string, what: string) => {
    Clipboard.setStringAsync(v);
    Haptics.selectionAsync().catch(() => {});
    setError("");
    setCopied(what);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.ink} />}>
      <View style={{ backgroundColor: ok ? C.ink : C.white, borderRadius: 32, padding: 22, gap: 12, borderWidth: ok ? 0 : 1, borderColor: C.line }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: ok ? C.white : waiting ? C.waitSoft : C.accentSoft }}>
          <Icon size={28} color={ok ? C.ink : waiting ? C.wait : C.accent} />
        </View>
        <H1 light={ok}>{ok ? "Pagamento confirmado" : waiting ? (p.next_action === "3ds" ? "Confirme no seu banco" : "A aguardar pagamento") : st.label}</H1>
        <P light={ok} muted={!ok}>
          {ok ? `${p.institution_name} recebeu o seu pagamento.` : waiting ? (p.next_action === "3ds" ? "O seu banco pede um código de confirmação." : p.instructions) : p.failure_reason || "O pagamento não foi concluído. Não foi cobrado."}
        </P>
        <Text style={{ fontFamily: F.display, fontSize: 34, color: ok ? C.white : C.ink }}>{formatMZN(p.total)}</Text>
      </View>

      {error ? <Alert>{error}</Alert> : null}
      {copied ? <Alert tone="ok">{copied} copiado.</Alert> : null}

      {waiting && p.next_action === "3ds" ? <ThreeDS p={p} onDone={load} /> : null}

      {waiting && p.bank ? (
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <MethodMark method="referencia_bancaria" />
            <H2>Dados para pagar no banco</H2>
          </View>
          <P muted size={14}>Balcão, ATM ou banca online, na opção Pagamento de serviços.</P>
          {[["Entidade", p.bank.entidade], ["Referência", p.bank.referencia.replace(/(\d{3})(?=\d)/g, "$1 ")], ["Montante", formatMZN(p.bank.valor)]].map(([l, v]) => (
            <Pressable key={l} accessibilityRole="button" accessibilityLabel={`Copiar ${l}`} onPress={() => copy(v.replace(/\s/g, ""), l)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.canvas, borderRadius: 18, padding: 14 }}>
              <View>
                <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>{l}</Text>
                <Text style={{ fontFamily: "monospace", fontSize: 20, fontWeight: "700", color: C.ink }}>{v}</Text>
              </View>
              <Copy size={20} color={C.ink} />
            </Pressable>
          ))}
        </Card>
      ) : null}

      {waiting && p.method === "qr" ? (
        <Card style={{ alignItems: "center", gap: 12 }}>
          <Image source={{ uri: `${API}/api/payments/${p.reference}/qr.svg` }} style={{ width: 220, height: 220 }} contentFit="contain" accessibilityLabel="Código QR do pagamento" />
          <H2>Leia com a app do banco</H2>
          <P muted size={14} style={{ textAlign: "center" }}>Ou mostre este ecrã no balcão. Fica válido enquanto o pagamento estiver pendente.</P>
        </Card>
      ) : null}

      {ok && p.delivery?.codigo ? (
        <Card dark style={{ gap: 10 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>{p.delivery.titulo}</Text>
          <Text selectable style={{ fontFamily: "monospace", fontSize: 24, fontWeight: "700", letterSpacing: 1, color: C.white }}>{p.delivery.codigo}</Text>
          {p.delivery.instrucao ? <P light size={14}>{p.delivery.instrucao}</P> : null}
          <Button variant="light" icon={Copy} onPress={() => copy(p.delivery!.codigo!, "Código")}>Copiar código</Button>
        </Card>
      ) : null}

      <Card style={{ gap: 2 }}>
        <Row label="Serviço" value={p.service_name} />
        <Row label="Instituição" value={p.institution_name} />
        <Row label="Método" value={p.card_last4 ? `${p.card_brand === "visa" ? "Visa" : "Mastercard"} •••• ${p.card_last4}` : METHOD_LABEL[p.method] ?? p.method} />
        <Row label="Estado" value={st.label} />
        <Row label="Referência" value={p.reference} />
        <Row label="Data" value={formatDateTime(p.created_at)} />
      </Card>

      {ok ? <Button icon={Download} onPress={() => WebBrowser.openBrowserAsync(`${API}/api/payments/${p.reference}/receipt.pdf`)}>Ver comprovativo (PDF)</Button> : null}
      {!waiting && !ok ? <Button icon={RotateCcw} onPress={() => router.replace(`/servico/${p.service}`)}>Tentar de novo</Button> : null}
      <Button variant="secondary" icon={ShieldCheck} onPress={() => router.dismissTo("/")}>Voltar ao início</Button>
    </ScrollView>
  );
}

/** Desafio 3-D Secure: o código chega por SMS do banco; na demonstração aparece aqui. */
function ThreeDS({ p, onDone }: { p: Payment; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const demo = demo3ds.get(p.reference);
  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <KeyRound size={22} color={C.ink} />
        <H2>Código do seu banco</H2>
      </View>
      <P muted size={14}>Enviámos o pedido ao banco do cartão. Escreva o código de 6 algarismos que recebeu por SMS.</P>
      {demo ? <Alert tone="info">{`Demonstração: o código é ${demo}`}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}
      <Field label="Código" keyboardType="number-pad" maxLength={6} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ""))} mono />
      <Button busy={busy} disabled={code.length !== 6}
        onPress={async () => {
          setBusy(true);
          setError("");
          try {
            await api(`/api/payments/${p.reference}/3ds`, { body: { code } });
            onDone();
          } catch (e) {
            setError(errorMessage(e));
            onDone();
          } finally {
            setBusy(false);
          }
        }}>Confirmar</Button>
    </Card>
  );
}
