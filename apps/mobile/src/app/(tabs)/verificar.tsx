import { CheckCircle2, FileSearch, ShieldCheck, XCircle } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert, Button, Card, Eyebrow, Field, H1, H2, P, Row } from "../../components/ui";
import { api, ApiError, errorMessage, type Schemas } from "../../lib/api";
import { formatDateTime, formatMZN } from "../../lib/format";
import { C } from "../../theme";

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
    if (!/^[2-9A-HJKMNP-Z]{10}$/.test(c)) return setError("O código tem 10 caracteres (ex.: 7KQ2M-XH4RT).");
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: top + 12, paddingHorizontal: 16, paddingBottom: 40, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: C.ink, borderRadius: 32, padding: 22, gap: 12 }}>
          <Eyebrow dark icon={ShieldCheck}>Autenticidade</Eyebrow>
          <H1 light>Verificar comprovativo</H1>
          <P light>Confirme se um comprovativo é verdadeiro e se o pagamento continua válido. Não precisa de conta.</P>
        </View>
        <Card style={{ gap: 14 }}>
          <Field label="Código de verificação" placeholder="7KQ2M-XH4RT" autoCapitalize="characters" value={code} onChangeText={setCode}
            hint="Está impresso no comprovativo, ao lado do QR." mono style={{ textAlign: "center", letterSpacing: 4 }} />
          <Button onPress={check} busy={busy} icon={FileSearch}>Verificar</Button>
        </Card>
        {error ? <Alert>{error}</Alert> : null}
        {v ? (
          <Card style={{ gap: 10, borderColor: good ? C.ok : C.accent, borderWidth: 1.5 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {good ? <CheckCircle2 size={26} color={C.ok} /> : <XCircle size={26} color={C.accent} />}
              <H2>{good ? "Comprovativo autêntico" : "Não confirmado"}</H2>
            </View>
            <P muted>{v.mensagem}</P>
            {good ? (
              <View>
                <Row label="Instituição" value={v.instituicao} />
                <Row label="Serviço" value={v.servico} />
                <Row label="Referência" value={v.referencia} />
                <Row label="Data" value={v.data_hora ? formatDateTime(v.data_hora) : "-"} />
                <Row label="Total" value={formatMZN(v.total)} strong />
              </View>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
