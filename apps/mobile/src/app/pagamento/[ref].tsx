import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { CheckCircle2, Clock3, Copy, Download, KeyRound, Landmark, RotateCcw, XCircle } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { BrandMark } from "../../components/brand";
import { Alert, Button, Card, Field, H2, Header, Loading, P, Row } from "../../components/ui";
import { API, api, errorMessage, type Payment } from "../../lib/api";
import { formatDateTime, formatMZN, METHOD_LABEL, PAYMENT_STATUS } from "../../lib/format";
import { t } from "../../lib/i18n";
import { demo3ds } from "../../lib/session";
import { C, F, R } from "../../theme";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { usePrefs } from "../../lib/prefs";

const WAITING = ["CRIADA", "PENDENTE"];

/** Estado do pagamento em ecrã escuro: valor grande, blocos de detalhe e o que fazer a seguir. */
export default function Pagamento() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const [p, setP] = useState<Payment | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState("");
  const was = useRef("");
  const { prefs } = usePrefs();

  const load = useCallback(async () => {
    try {
      const np = await api<Payment>(`/api/payments/${ref}`);
      if (was.current && WAITING.includes(was.current) && !WAITING.includes(np.status)) {
        const ok = ["CONFIRMADA", "LIQUIDADA"].includes(np.status);
        Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
        if (ok && prefs.notifyPayments && Platform.OS !== "web")
          Notifications.scheduleNotificationAsync({ content: { title: t("Pagamento confirmado"), body: `${np.service_name} · ${formatMZN(np.total)}` }, trigger: null }).catch(() => {});
      }
      was.current = np.status;
      setP(np);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [ref, prefs.notifyPayments]);

  useEffect(() => { load(); }, [load]);
  // Enquanto espera, pergunta à API a cada 3 s (a confirmação chega do provedor).
  useEffect(() => {
    if (!p || !WAITING.includes(p.status)) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [p, load]);

  const copy = (v: string, what: string) => {
    Clipboard.setStringAsync(v);
    Haptics.selectionAsync().catch(() => {});
    setCopied(what);
  };

  const body = () => {
    if (!p) return error ? <View style={{ padding: 16 }}><Alert>{error}</Alert></View> : <Loading />;
    const waiting = WAITING.includes(p.status);
    const ok = ["CONFIRMADA", "LIQUIDADA"].includes(p.status);
    const st = PAYMENT_STATUS[p.status] ?? { label: p.status, tone: "info" };
    const Icon = ok ? CheckCircle2 : waiting ? Clock3 : XCircle;
    const tone = ok ? "#4cc27e" : waiting ? "#f2b94b" : "#ff6b72";
    const title = ok ? t("Pagamento confirmado") : waiting ? t(p.next_action === "3ds" ? "Confirme no seu banco" : "A aguardar pagamento") : st.label;

    return (
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor="#fff" />}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: F.display, fontSize: 28, letterSpacing: -0.8, color: C.onHero }}>{title}</Text>
          <Text style={{ fontFamily: F.body, fontSize: 15, color: "rgba(255,255,255,0.6)" }}>
            {ok ? p.institution_name : waiting ? (p.next_action === "3ds" ? t("Código do seu banco") : p.instructions) : p.failure_reason || st.label}
          </Text>
        </View>

        {/* Valor e estado */}
        <Card dark style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <BrandMark slug={p.institution_slug} name={p.institution_name} size={46} round />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.onHero }} numberOfLines={1}>{p.service_name}</Text>
              <Text style={{ fontFamily: F.body, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{formatDateTime(p.created_at)}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: F.display, fontSize: 36, letterSpacing: -1.2, color: C.onHero }}>{formatMZN(p.total)}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Icon size={14} color={tone} />
              <Text style={{ fontFamily: F.semi, fontSize: 12, color: C.onHero }}>{st.label}</Text>
            </View>
          </View>
        </Card>

        {error ? <Alert>{error}</Alert> : null}
        {copied ? <Alert tone="ok">{`${copied} ✓`}</Alert> : null}

        {waiting && p.next_action === "3ds" ? <ThreeDS p={p} onDone={load} /> : null}

        {waiting && p.bank ? (
          <Card dark style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Landmark size={18} color={C.onHero} />
              <H2 light>{t("Dados para pagar no banco")}</H2>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[[t("Entidade"), p.bank.entidade], [t("Montante"), formatMZN(p.bank.valor)]].map(([l, v]) => (
                <Tile key={l} label={l} value={v} onPress={() => copy(v.replace(/\s/g, ""), l)} />
              ))}
            </View>
            <Tile label={t("Referência")} value={p.bank.referencia.replace(/(\d{3})(?=\d)/g, "$1 ")} big onPress={() => copy(p.bank!.referencia, t("Referência"))} />
          </Card>
        ) : null}

        {waiting && p.method === "qr" ? (
          <Card dark style={{ alignItems: "center", gap: 12 }}>
            <View style={{ backgroundColor: "#ffffff", borderRadius: 20, padding: 12 }}>
              <Image source={{ uri: `${API}/api/payments/${p.reference}/qr.svg` }} style={{ width: 200, height: 200 }} contentFit="contain" accessibilityLabel="QR" />
            </View>
            <H2 light>{t("Leia com a app do banco")}</H2>
          </Card>
        ) : null}

        {ok && p.delivery?.codigo ? (
          <Card style={{ gap: 10 }}>
            <Text style={{ fontFamily: F.semi, fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase", color: C.muted }}>{p.delivery.titulo}</Text>
            <Text selectable style={{ fontFamily: "monospace", fontSize: 23, fontWeight: "700", letterSpacing: 1, color: C.ink }}>{p.delivery.codigo}</Text>
            {p.delivery.instrucao ? <P muted size={14}>{p.delivery.instrucao}</P> : null}
            <Button icon={Copy} onPress={() => copy(p.delivery!.codigo!, t("Copiar código"))}>{t("Copiar código")}</Button>
          </Card>
        ) : null}

        <Card dark style={{ paddingVertical: 6 }}>
          <Row dark label={t("Método")} value={p.card_last4 ? `${p.card_brand === "visa" ? "Visa" : "Mastercard"} •••• ${p.card_last4}` : METHOD_LABEL[p.method] ?? p.method} />
          <Row dark label={t("Instituição")} value={p.institution_name} />
          <Row dark label={t("Referência")} value={p.reference} />
        </Card>

        {ok ? <Button variant="light" icon={Download} onPress={() => WebBrowser.openBrowserAsync(`${API}/api/payments/${p.reference}/receipt.pdf`)}>{t("Ver comprovativo (PDF)")}</Button> : null}
        {!waiting && !ok ? <Button variant="light" icon={RotateCcw} onPress={() => router.replace(`/servico/${p.service}`)}>{t("Tentar de novo")}</Button> : null}
        <Pressable accessibilityRole="button" onPress={() => router.dismissTo("/")} style={{ alignSelf: "center", padding: 12 }}>
          <Text style={{ fontFamily: F.semi, fontSize: 15, color: "rgba(255,255,255,0.7)" }}>{t("Voltar ao início")}</Text>
        </Pressable>
      </ScrollView>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.hero }}>
      <Header dark title={t("Pagamento")} />
      {body()}
    </View>
  );
}

function Tile({ label, value, onPress, big }: { label: string; value: string; onPress: () => void; big?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, padding: 14, gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: F.body, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{label}</Text>
        <Copy size={14} color="rgba(255,255,255,0.55)" />
      </View>
      <Text style={{ fontFamily: "monospace", fontSize: big ? 22 : 17, fontWeight: "700", color: C.onHero }}>{value}</Text>
    </Pressable>
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <KeyRound size={20} color={C.ink} />
        <H2>{t("Código do seu banco")}</H2>
      </View>
      {demo ? <Alert tone="info">{`Demo: ${demo}`}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}
      <Field label="SMS" keyboardType="number-pad" maxLength={6} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ""))} mono />
      <Button busy={busy} disabled={code.length !== 6}
        onPress={async () => {
          setBusy(true);
          setError("");
          try {
            await api(`/api/payments/${p.reference}/3ds`, { body: { code } });
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
            onDone();
          }
        }}>{t("Confirmar")}</Button>
    </Card>
  );
}
