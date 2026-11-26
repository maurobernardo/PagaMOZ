import { router } from "expo-router";
import { ArrowUp, ShieldAlert, Sparkles, Volume2 } from "lucide-react-native";
import { speak } from "../lib/voice";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Header } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { t } from "../lib/i18n";
import { openPrefilled } from "../lib/intel";
import { C, F, R, shadow } from "../theme";

type Action = { type: "service" | "payment" | "open"; label: string; service?: number; fields?: Record<string, string>; amount?: number | null; reference?: string; path?: string };
type Scam = { level: "alto" | "medio" | "baixo"; reasons: string[]; tip: string };
type Msg = { from: "me" | "bot"; text: string; actions?: Action[]; suggestions?: string[]; scam?: Scam };

const START: Msg = {
  from: "bot",
  text: "Olá! Diga-me o que quer pagar ou pergunte o que vence esta semana.",
  suggestions: ["Paga 500 de Credelec", "O que vence esta semana?", "Quanto tempo dura a minha luz?", "Isto é burla?"],
};

/** Assistente: escreve o pedido em linguagem normal; ele prepara, a pessoa confirma no ecrã de sempre. */
export default function Assistente() {
  const bottom = useSafeAreaInsets().bottom;
  const [msgs, setMsgs] = useState<Msg[]>([{ ...START, text: t(START.text) }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  async function send(message: string) {
    const m = message.trim();
    if (!m || busy) return;
    setText("");
    setMsgs((x) => [...x, { from: "me", text: m }]);
    setBusy(true);
    try {
      const r = await api<{ reply: string; actions: Action[]; suggestions?: string[]; scam?: Scam }>("/api/intel/assistant", { body: { message: m } });
      setMsgs((x) => [...x, { from: "bot", text: r.reply, actions: r.actions, suggestions: r.suggestions, scam: r.scam }]);
    } catch (e) {
      setMsgs((x) => [...x, { from: "bot", text: errorMessage(e) }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  function run(a: Action) {
    if (a.type === "service" && a.service) openPrefilled(a.service, a.fields ?? {}, a.amount);
    else if (a.type === "payment" && a.reference) router.push(`/pagamento/${a.reference}`);
    else if (a.path === "/contas") router.push("/contas");
    else if (a.path === "/entrar") router.push("/cadastro?entrar=1");
    else if (a.path?.startsWith("/verificar")) router.push("/verificar");
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.canvas }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title={t("Assistente")} />
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 12 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {msgs.map((m, i) => (
          <View key={i} style={{ alignItems: m.from === "me" ? "flex-end" : "flex-start", gap: 8 }}>
            <View style={[{ maxWidth: "86%", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12 },
              m.from === "me" ? { backgroundColor: C.ink, borderBottomRightRadius: 6 } : { backgroundColor: C.surface, borderBottomLeftRadius: 6, ...shadow() }]}>
              {m.from === "bot" && i === 0 ? <Sparkles size={16} color={C.ink} style={{ marginBottom: 6 }} /> : null}
              <Text style={{ fontFamily: F.body, fontSize: 15, lineHeight: 21, color: m.from === "me" ? C.white : C.ink }}>{m.text}</Text>
              {m.from === "bot" ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t("Ouvir")} onPress={() => speak(m.text)} hitSlop={8} style={{ marginTop: 6, alignSelf: "flex-start" }}>
                  <Volume2 size={16} color={C.muted} />
                </Pressable>
              ) : null}
              {m.scam ? (
                <View style={{ marginTop: 10, gap: 6 }}>
                  {m.scam.reasons.map((r) => (
                    <View key={r} style={{ flexDirection: "row", gap: 6 }}>
                      <ShieldAlert size={14} color={m.scam!.level === "baixo" ? C.muted : C.accent} style={{ marginTop: 2 }} />
                      <Text style={{ flex: 1, fontFamily: F.body, fontSize: 13, color: C.ink }}>{r}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
            {m.actions?.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {m.actions.map((a, k) => (
                  <Pressable key={k} accessibilityRole="button" onPress={() => run(a)}
                    style={{ minHeight: 42, paddingHorizontal: 16, justifyContent: "center", borderRadius: R.pill, backgroundColor: k === 0 ? C.ink : C.surface, ...(k === 0 ? {} : shadow()) }}>
                    <Text style={{ fontFamily: F.semi, fontSize: 14, color: k === 0 ? C.white : C.ink }}>{a.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {m.suggestions?.length && i === msgs.length - 1 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {m.suggestions.map((s) => (
                  <Pressable key={s} accessibilityRole="button" onPress={() => send(s)}
                    style={{ minHeight: 38, paddingHorizontal: 14, justifyContent: "center", borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface }}>
                    <Text style={{ fontFamily: F.semi, fontSize: 13, color: C.ink }}>{t(s)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ))}
        {busy ? <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted }}>…</Text> : null}
      </ScrollView>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, paddingBottom: bottom + 12, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.surface }}>
        <TextInput value={text} onChangeText={setText} placeholder={t("Escreva o que quer pagar…")} placeholderTextColor={C.muted} multiline
          accessibilityLabel={t("Mensagem")} onSubmitEditing={() => send(text)} blurOnSubmit
          style={{ flex: 1, minHeight: 46, maxHeight: 120, borderRadius: 23, backgroundColor: C.soft, paddingHorizontal: 16, paddingTop: 12, fontFamily: F.body, fontSize: 16, color: C.ink }} />
        <Pressable accessibilityRole="button" accessibilityLabel={t("Enviar")} onPress={() => send(text)} disabled={!text.trim() || busy}
          style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.ink, alignItems: "center", justifyContent: "center", opacity: !text.trim() || busy ? 0.4 : 1 }}>
          <ArrowUp size={20} color={C.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
