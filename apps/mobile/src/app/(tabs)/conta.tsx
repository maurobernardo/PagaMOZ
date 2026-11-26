import { router, useFocusEffect } from "expo-router";
import { CheckCircle2, Clock3, KeyRound, LogOut, MapPin, MessageSquareText, Pencil, Settings, XCircle } from "lucide-react-native";
import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandMark } from "../../components/brand";
import { Alert, Button, Card, Field, Loading, P, PageTitle, Progress, Ring, RoundButton, Segmented } from "../../components/ui";
import { api, errorMessage, type Payment } from "../../lib/api";
import { formatDateTime, formatMZN, isValidPhone, normalizePhone, PAYMENT_STATUS } from "../../lib/format";
import { t } from "../../lib/i18n";
import { initials, prettyPhone, useMe, type Me } from "../../lib/me";
import { C, F, shadow } from "../../theme";

export default function Conta() {
  const { me, setMe, reload } = useMe();
  if (me === undefined) return <View style={{ flex: 1, backgroundColor: C.canvas }}><Loading /></View>;
  return me ? <Profile me={me} onLogout={() => setMe(null)} /> : <Login onDone={reload} />;
}

function TopBar({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <View style={{ flex: 1 }}><PageTitle title={title} sub={sub} /></View>
      <RoundButton icon={Settings} label={t("Definições")} onPress={() => router.push("/definicoes")} />
    </View>
  );
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
    if (!isValidPhone(phone)) return setError(`${t("Verifique o que escreveu.")} (84 123 4567)`);
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.canvas }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: top + 16, paddingHorizontal: 18, paddingBottom: 120, gap: 18 }} keyboardShouldPersistTaps="handled">
        <TopBar title={t("Entre com o seu número")} sub={t("Veja todos os seus pagamentos e comprovativos. Enviamos um código por SMS, sem palavra-passe.")} />
        <Card style={{ gap: 14 }}>
          {error ? <Alert>{error}</Alert> : null}
          {!sent ? (
            <>
              <Field label={t("Número de telefone")} keyboardType="phone-pad" placeholder="84 123 4567" value={phone} onChangeText={setPhone} autoComplete="tel" />
              <Button onPress={request} busy={busy} icon={MessageSquareText}>{t("Receber código")}</Button>
            </>
          ) : (
            <>
              <P muted>{phone}</P>
              {demo ? <Alert tone="info">{`Demo: ${demo}`}</Alert> : null}
              <Field label={t("Código de 6 algarismos")} keyboardType="number-pad" maxLength={6} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ""))} autoComplete="sms-otp" mono />
              <Button onPress={verify} busy={busy} disabled={code.length !== 6} icon={KeyRound}>{t("Entrar")}</Button>
              <Button variant="ghost" onPress={() => { setSent(false); setCode(""); }}>{t("Mudar de número")}</Button>
            </>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type Filter = "all" | "ok" | "wait" | "bad";
const toneOf = (s: string): Exclude<Filter, "all"> => (["CONFIRMADA", "LIQUIDADA"].includes(s) ? "ok" : ["CRIADA", "PENDENTE"].includes(s) ? "wait" : "bad");

function Profile({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const top = useSafeAreaInsets().top;
  const [items, setItems] = useState<Payment[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const load = useCallback(async () => {
    try {
      const r = await api<Payment[] | { results: Payment[] }>("/api/me/payments");
      setItems(Array.isArray(r) ? r : r.results);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = items ?? [];
  const done = list.filter((p) => toneOf(p.status) === "ok");
  const shown = filter === "all" ? list : list.filter((p) => toneOf(p.status) === filter);
  const where = [me.district, me.province].filter(Boolean).join(", ");

  return (
    <ScrollView style={{ backgroundColor: C.canvas }} contentContainerStyle={{ paddingTop: top + 16, paddingHorizontal: 18, paddingBottom: 120, gap: 18 }}>
      <TopBar title={t("Perfil")} />

      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: F.display, fontSize: 22, color: C.white }}>{initials(me)}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: F.display, fontSize: 19, color: C.ink }} numberOfLines={1}>{me.name || prettyPhone(me.phone)}</Text>
          <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted }}>{prettyPhone(me.phone)}</Text>
          {where ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MapPin size={12} color={C.muted} />
              <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }} numberOfLines={1}>{where}</Text>
            </View>
          ) : null}
        </View>
        <RoundButton icon={Pencil} label={t("Editar perfil")} onPress={() => router.push("/perfil")} />
      </Card>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Card style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 20 }}>
          <Ring value={list.length ? done.length / list.length : 0} size={116}>
            <Text style={{ fontFamily: F.display, fontSize: 26, color: C.ink }}>{done.length}/{list.length}</Text>
            <Text style={{ fontFamily: F.body, fontSize: 11, color: C.muted }}>{t("Pagos")}</Text>
          </Ring>
        </Card>
        <Card dark style={{ flex: 1, justifyContent: "space-between", gap: 10 }}>
          <Text style={{ fontFamily: F.display, fontSize: 30, color: C.onHero }}>“</Text>
          <Text style={{ fontFamily: F.light, fontSize: 20, lineHeight: 26, color: C.onHero }} adjustsFontSizeToFit numberOfLines={1}>
            {formatMZN(done.reduce((a, p) => a + p.total, 0)).replace(",00", "")}
          </Text>
          <Text style={{ fontFamily: F.body, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{t("Total pago")}</Text>
        </Card>
      </View>

      <Segmented<Filter> value={filter} onChange={setFilter}
        options={[{ key: "all", label: t("Todos") }, { key: "ok", label: t("Pagos") }, { key: "wait", label: t("Pendentes") }, { key: "bad", label: t("Falhados") }]} />

      {error ? <Alert>{error}</Alert> : null}
      {items === null ? <Loading /> : shown.length === 0 ? <P muted>{t("Ainda não pagou nada com esta conta.")}</P> : (
        <View style={{ gap: 10 }}>
          {shown.map((p) => {
            const tone = toneOf(p.status);
            const color = { ok: C.ok, wait: C.wait, bad: C.accent }[tone];
            const Icon = { ok: CheckCircle2, wait: Clock3, bad: XCircle }[tone];
            return (
              <Pressable key={p.reference} accessibilityRole="button" onPress={() => router.push(`/pagamento/${p.reference}`)}
                style={({ pressed }) => ({ backgroundColor: C.surface, borderRadius: 20, padding: 14, gap: 10, transform: [{ scale: pressed ? 0.985 : 1 }], ...shadow() })}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <BrandMark slug={p.institution_slug} name={p.institution_name} size={42} round />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.ink }} numberOfLines={1}>{p.service_name}</Text>
                    <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>{formatDateTime(p.created_at)} · {formatMZN(p.total)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={{ fontFamily: F.semi, fontSize: 12, color }}>{PAYMENT_STATUS[p.status]?.label}</Text>
                    <Icon size={15} color={color} />
                  </View>
                </View>
                <Progress value={tone === "wait" ? 0.5 : 1} tone={color} />
              </Pressable>
            );
          })}
        </View>
      )}

      <Button variant="danger" icon={LogOut} onPress={async () => { await api("/api/auth/logout", { body: {} }).catch(() => {}); onLogout(); }}>{t("Sair")}</Button>
    </ScrollView>
  );
}
