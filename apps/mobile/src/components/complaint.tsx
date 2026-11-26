import { MessageSquareWarning } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { api, errorMessage } from "../lib/api";
import { t } from "../lib/i18n";
import { C, F, R } from "../theme";
import { Alert, Button, Card, H2 } from "./ui";

type Complaint = { id: number; reason_label: string; message: string; status: string; status_label: string; response: string; created_at: string };
const REASONS: [string, string][] = [["nao_recebi", "Não recebi o serviço"], ["valor_errado", "Valor errado"], ["duplicado", "Paguei duas vezes"], ["outro", "Outro"]];

/** "Tenho um problema": a pessoa reclama; a instituição responde e a resposta aparece aqui. */
export function ComplaintBox({ reference }: { reference: string }) {
  const [list, setList] = useState<Complaint[]>([]);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("nao_recebi");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    api<Complaint[]>(`/api/payments/${reference}/complaints`).then(setList).catch(() => {});
  }, [reference]);
  useEffect(() => { load(); }, [load]);
  const active = list.find((c) => ["aberta", "em_analise"].includes(c.status));

  async function send() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/payments/${reference}/complaints`, { body: { reason, message: message.trim() } });
      setOpen(false);
      setMessage("");
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: 12 }}>
      {list.map((c) => (
        <View key={c.id} style={{ gap: 4, paddingBottom: 10, borderBottomWidth: 1, borderColor: C.line }}>
          <Text style={{ fontFamily: F.semi, fontSize: 14, color: C.ink }}>{c.reason_label} · {c.status_label}</Text>
          <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted }}>{c.message}</Text>
          {c.response ? <Alert tone={c.status === "resolvida" ? "ok" : "info"}>{`${t("Resposta da instituição")}: ${c.response}`}</Alert> : null}
        </View>
      ))}
      {!open ? (
        active ? <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted }}>{t("A instituição está a analisar. Recebe aviso quando responder.")}</Text> : (
          <Button variant="secondary" icon={MessageSquareWarning} onPress={() => setOpen(true)}>{t("Tenho um problema")}</Button>
        )
      ) : (
        <View style={{ gap: 12 }}>
          <H2>{t("O que aconteceu?")}</H2>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {REASONS.map(([k, l]) => (
              <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: reason === k }} onPress={() => setReason(k)}
                style={{ minHeight: 40, paddingHorizontal: 14, justifyContent: "center", borderRadius: R.pill, backgroundColor: reason === k ? C.ink : C.soft }}>
                <Text style={{ fontFamily: F.semi, fontSize: 13, color: reason === k ? C.white : C.ink }}>{t(l)}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={message} onChangeText={setMessage} multiline maxLength={1000} placeholder={t("Explique em poucas palavras…")} placeholderTextColor={C.muted}
            accessibilityLabel={t("Mensagem")} style={{ minHeight: 100, borderRadius: R.field, borderWidth: 1.5, borderColor: C.line, padding: 12, textAlignVertical: "top", fontFamily: F.body, fontSize: 15, color: C.ink, backgroundColor: C.surface }} />
          {error ? <Alert>{error}</Alert> : null}
          <Button busy={busy} disabled={message.trim().length < 5} onPress={send}>{t("Enviar à instituição")}</Button>
          <Button variant="ghost" onPress={() => setOpen(false)}>{t("Cancelar")}</Button>
        </View>
      )}
    </Card>
  );
}
