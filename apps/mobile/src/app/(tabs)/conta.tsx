import { router, useFocusEffect } from "expo-router";
import { ChevronRight, KeyRound, LogOut, MessageSquareText, User } from "lucide-react-native";
import { useCallback, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandMark } from "../../components/brand";
import { Alert, Button, Card, Eyebrow, Field, H1, H2, Loading, P } from "../../components/ui";
import { api, ApiError, errorMessage, type Payment } from "../../lib/api";
import { formatDateTime, formatMZN, isValidPhone, normalizePhone, PAYMENT_STATUS } from "../../lib/format";
import { C, F, R } from "../../theme";

type Me = { phone: string };

export default function Conta() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const load = useCallback(() => {
    api<Me>("/api/me").then(setMe).catch((e) => setMe(e instanceof ApiError && [401, 403].includes(e.status) ? null : null));
  }, []);
  useFocusEffect(load);
  if (me === undefined) return <Loading />;
  return me ? <History me={me} onLogout={() => setMe(null)} /> : <Login onDone={load} />;
}

/** Entrar com o número de telefone e um código por SMS. Sem palavra-passe. */
function Login({ onDone }: { onDone: () => void }) {
  const top = useSafeAreaInsets().top;
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [demo, setDemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function request() {
    if (!isValidPhone(phone)) return setError("Número inválido. Exemplo: 84 123 4567.");
    setBusy(true);
    setError("");
    try {
      const r = await api<{ demo_code?: string }>("/api/auth/otp/request", { body: { phone: normalizePhone(phone) } });
      setDemo(r.demo_code ?? "");
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/otp/verify", { body: { phone: normalizePhone(phone), code } });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList data={[]} renderItem={() => null} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: top + 12, paddingHorizontal: 16, paddingBottom: 40, gap: 16 }}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <View style={{ backgroundColor: C.ink, borderRadius: 32, padding: 22, gap: 12 }}>
              <Eyebrow dark icon={User}>A minha conta</Eyebrow>
              <H1 light>Entre com o seu número</H1>
              <P light>Veja todos os seus pagamentos e comprovativos. Enviamos um código por SMS, sem palavra-passe.</P>
            </View>
            <Card style={{ gap: 14 }}>
              {error ? <Alert>{error}</Alert> : null}
              {!sent ? (
                <>
                  <Field label="Número de telefone" keyboardType="phone-pad" placeholder="84 123 4567" value={phone} onChangeText={setPhone} autoComplete="tel" />
                  <Button onPress={request} busy={busy} icon={MessageSquareText}>Receber código</Button>
                </>
              ) : (
                <>
                  <P muted>{`Enviámos um código para ${phone}.`}</P>
                  {demo ? <Alert tone="info">{`Demonstração: o código é ${demo}`}</Alert> : null}
                  <Field label="Código de 6 algarismos" keyboardType="number-pad" maxLength={6} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ""))} autoComplete="sms-otp" mono />
                  <Button onPress={verify} busy={busy} disabled={code.length !== 6} icon={KeyRound}>Entrar</Button>
                  <Button variant="ghost" onPress={() => { setSent(false); setCode(""); }}>Mudar de número</Button>
                </>
              )}
            </Card>
          </View>
        } />
    </KeyboardAvoidingView>
  );
}

function History({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const top = useSafeAreaInsets().top;
  const [items, setItems] = useState<Payment[] | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await api<Payment[] | { results: Payment[] }>("/api/me/payments");
      setItems(Array.isArray(r) ? r : r.results);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <FlatList
      data={items ?? []}
      keyExtractor={(p) => p.reference}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
      refreshing={refreshing}
      contentContainerStyle={{ paddingTop: top + 12, paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
      ListHeaderComponent={
        <View style={{ gap: 16, marginBottom: 6 }}>
          <View style={{ backgroundColor: C.ink, borderRadius: 32, padding: 22, gap: 12 }}>
            <Eyebrow dark icon={User}>A minha conta</Eyebrow>
            <H1 light>{me.phone.replace(/^\+258(\d{2})(\d{3})(\d{4})$/, "$1 $2 $3")}</H1>
            <Button variant="light" icon={LogOut} onPress={async () => { await api("/api/auth/logout", { body: {} }).catch(() => {}); onLogout(); }}>Sair</Button>
          </View>
          <H2>Os meus pagamentos</H2>
          {error ? <Alert>{error}</Alert> : null}
        </View>
      }
      ListEmptyComponent={items === null ? <Loading /> : <P muted>Ainda não pagou nada com esta conta.</P>}
      renderItem={({ item: p }) => {
        const st = PAYMENT_STATUS[p.status] ?? { label: p.status, tone: "info" };
        const tone = { ok: C.ok, wait: C.wait, bad: C.accent, info: C.muted }[st.tone];
        return (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/pagamento/${p.reference}`)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.white, borderRadius: R.card, borderWidth: 1, borderColor: pressed ? C.ink : C.line, padding: 14 })}>
            <BrandMark slug={p.institution_slug} name={p.institution_name} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 15 }} numberOfLines={1}>{p.service_name}</Text>
              <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>{formatDateTime(p.created_at)}</Text>
              <Text style={{ fontFamily: F.bold, fontSize: 12, color: tone }}>{st.label}</Text>
            </View>
            <Text style={{ fontFamily: F.display, fontSize: 15 }}>{formatMZN(p.total)}</Text>
            <ChevronRight size={18} color={C.muted} />
          </Pressable>
        );
      }}
    />
  );
}
