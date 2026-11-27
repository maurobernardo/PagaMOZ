import { router } from "expo-router";
import { CheckCircle2, FileSearch, ShieldAlert, ShieldCheck, XCircle } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert, Button, Card, Eyebrow, Field, H2, P, PageTitle, Row } from "../../components/ui";
import { api, ApiError, errorMessage, type Schemas } from "../../lib/api";
import { formatDateTime, formatMZN } from "../../lib/format";
import { t } from "../../lib/i18n";
import { C, F } from "../../theme";

/** Confirma se um comprovativo PagaMOZ é verdadeiro, pelo código impresso ao lado do QR. */
export default function Verificar() {
  const top = useSafeAreaInsets().top;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [v, setV] = useState<Schemas["Verification"] | null>(null);

  async function check() {
    const c = code.toUpperCase().replace(/[\s-]/g, "");
    setV(null);
    if (!/^[2-9A-HJKMNP-Z]{10}$/.test(c)) return setError(`${t("Verifique o que escreveu.")} (7KQ2M-XH4RT)`);
    setBusy(true);
    setError("");
    try {
      setV(await api<Schemas["Verification"]>(`/api/receipts/${c}`));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setV({ resultado: "invalido", mensagem: "Este código não corresponde a nenhum comprovativo PagaMOZ." } as unknown as Schemas["Verification"]);
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const good = v?.resultado === "valido";
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.canvas }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingTop: top + 16, paddingHorizontal: 18, paddingBottom: 120, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Eyebrow icon={ShieldCheck}>PagaMOZ</Eyebrow>
        <PageTitle title={t("Verificar comprovativo")} sub={t("Confirme se um comprovativo é verdadeiro e se o pagamento continua válido. Não precisa de conta.")} />
        <Card style={{ gap: 14 }}>
          <Field label={t("Código de verificação")} placeholder="7KQ2M-XH4RT" autoCapitalize="characters" value={code} onChangeText={setCode}
            hint={t("Está impresso no comprovativo, ao lado do QR.")} error={error.includes("7KQ2M") ? error : undefined} mono style={{ textAlign: "center", letterSpacing: 4 }} />
          <Button onPress={check} busy={busy} icon={FileSearch}>{t("Verificar")}</Button>
        </Card>
        {v ? (
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {good ? <CheckCircle2 size={26} color={C.ok} /> : <XCircle size={26} color={C.accent} />}
              <H2>{t(good ? "Comprovativo autêntico" : v.resultado === "utilizado" ? "Comprovativo já utilizado" : "Não confirmado")}</H2>
            </View>
            <P muted>{v.mensagem}</P>
            {good ? (
              <View>
                <Row label={t("Instituição")} value={v.instituicao} />
                <Row label={t("Serviço")} value={v.servico} />
                <Row label={t("Referência")} value={v.referencia} />
                {v.deposito ? (
                  <>
                    <Row label={t("Depositado em")} value={`${v.deposito.banco} · ${v.deposito.conta}`} />
                    <Row label={t("Depositante")} value={String(v.depositante?.nome ?? "")} />
                    <Row label={t("BI (parcial)")} value={String(v.depositante?.bi ?? "")} />
                  </>
                ) : null}
                <Row label={t("Data")} value={v.data_hora ? formatDateTime(v.data_hora) : "-"} />
                <Row label="Total" value={formatMZN(v.total)} strong />
              </View>
            ) : null}
          </Card>
        ) : null}
        {error && !error.includes("7KQ2M") ? <Alert>{error}</Alert> : null}
        <Pressable accessibilityRole="button" onPress={() => router.push("/burla")}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.hero, borderRadius: 24, padding: 18, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
            <ShieldAlert size={20} color={C.onHero} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.display, fontSize: 17, color: C.onHero }}>{t("Recebeu uma mensagem suspeita?")}</Text>
            <Text style={{ fontFamily: F.body, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{t("Verificamos se tem sinais de burla.")}</Text>
          </View>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
