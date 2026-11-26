import * as Clipboard from "expo-clipboard";
import { ClipboardPaste, ShieldAlert, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { Button, Card, Header, P, PageTitle } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { t } from "../lib/i18n";
import { C, F, R } from "../theme";

type Result = { level: "alto" | "medio" | "baixo"; reasons: string[]; summary: string; tip: string };

/** Escudo contra burlas: cole a mensagem que recebeu e vemos os sinais de fraude. */
export default function Burla() {
  const [text, setText] = useState("");
  const [r, setR] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function check() {
    setBusy(true);
    setError("");
    try {
      setR(await api<Result>("/api/intel/scam-check", { body: { message: text } }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const color = r ? { alto: C.accent, medio: C.wait, baixo: C.ok }[r.level] : C.ink;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.canvas }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title={t("Verificar mensagem")} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <PageTitle title={t("Isto é burla?")} sub={t("Cole a mensagem que recebeu (SMS ou WhatsApp). Mostramos os sinais de fraude.")} />
        <Card style={{ gap: 12 }}>
          <TextInput value={text} onChangeText={setText} multiline placeholder={t("Cole aqui a mensagem…")} placeholderTextColor={C.muted}
            accessibilityLabel={t("Mensagem")}
            style={{ minHeight: 130, borderRadius: R.field, borderWidth: 1.5, borderColor: C.line, padding: 14, textAlignVertical: "top", fontFamily: F.body, fontSize: 15, color: C.ink, backgroundColor: C.surface }} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button variant="secondary" icon={ClipboardPaste} style={{ flex: 1 }} onPress={async () => setText(await Clipboard.getStringAsync())}>{t("Colar")}</Button>
            <Button icon={ShieldCheck} style={{ flex: 1 }} busy={busy} disabled={text.trim().length < 5} onPress={check}>{t("Verificar")}</Button>
          </View>
        </Card>
        {error ? <P muted>{error}</P> : null}
        {r ? (
          <Card style={{ gap: 12, borderWidth: 1.5, borderColor: color }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {r.level === "baixo" ? <ShieldCheck size={24} color={color} /> : <ShieldAlert size={24} color={color} />}
              <Text style={{ flex: 1, fontFamily: F.display, fontSize: 18, color }}>{r.summary}</Text>
            </View>
            {r.reasons.map((x) => (
              <View key={x} style={{ flexDirection: "row", gap: 8 }}>
                <ShieldAlert size={14} color={color} style={{ marginTop: 3 }} />
                <Text style={{ flex: 1, fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.ink }}>{x}</Text>
              </View>
            ))}
            <P muted size={13}>{r.tip}</P>
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
