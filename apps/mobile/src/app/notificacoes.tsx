import { router, useFocusEffect } from "expo-router";
import { BellOff, CheckCircle2, Clock3, XCircle } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button, Header, Loading, P, PageTitle } from "../components/ui";
import { api, type Payment } from "../lib/api";
import { formatDateTime, formatMZN } from "../lib/format";
import { t } from "../lib/i18n";
import { useMe } from "../lib/me";
import { C, F, shadow } from "../theme";

/** Notificações: o que aconteceu aos seus pagamentos, do mais recente para o mais antigo. */
export default function Notificacoes() {
  const { me } = useMe();
  const [items, setItems] = useState<Payment[] | null>(null);
  const load = useCallback(() => {
    api<Payment[] | { results: Payment[] }>("/api/me/payments")
      .then((r) => setItems(Array.isArray(r) ? r : r.results))
      .catch(() => setItems([]));
  }, []);
  useFocusEffect(load);

  const text = (p: Payment) => {
    if (["CONFIRMADA", "LIQUIDADA"].includes(p.status)) return [CheckCircle2, C.ok, `${t("Pagamento confirmado")}: ${p.service_name}`, p.delivery?.codigo ? `${p.delivery.titulo}: ${p.delivery.codigo}` : p.institution_name] as const;
    if (["CRIADA", "PENDENTE"].includes(p.status)) return [Clock3, C.wait, `${t("A aguardar pagamento")}: ${p.service_name}`, p.instructions || p.institution_name] as const;
    return [XCircle, C.accent, `${p.service_name}`, p.failure_reason || p.status] as const;
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <Header title={t("Notificações")} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 60 }}>
        <PageTitle title={t("Notificações")} />
        {me === null ? (
          <View style={{ gap: 14, alignItems: "flex-start" }}>
            <P muted>{t("Entre para receber o estado dos seus pagamentos aqui.")}</P>
            <Button onPress={() => router.push("/cadastro?entrar=1")}>{t("Entrar")}</Button>
          </View>
        ) : items === null ? <Loading /> : items.length === 0 ? (
          <View style={{ alignItems: "center", gap: 10, padding: 40 }}>
            <BellOff size={30} color={C.muted} />
            <P muted>{t("Sem notificações por agora.")}</P>
          </View>
        ) : items.map((p) => {
          const [Icon, color, title, sub] = text(p);
          return (
            <Pressable key={p.reference} accessibilityRole="button" onPress={() => router.push(`/pagamento/${p.reference}`)}
              style={({ pressed }) => ({ flexDirection: "row", gap: 12, backgroundColor: C.surface, borderRadius: 20, padding: 14, transform: [{ scale: pressed ? 0.985 : 1 }], ...shadow() })}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.soft, alignItems: "center", justifyContent: "center" }}>
                <Icon size={18} color={color} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: F.semi, fontSize: 14, color: C.ink }}>{title}</Text>
                <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted }} numberOfLines={2}>{sub}</Text>
                <Text style={{ fontFamily: F.body, fontSize: 11, color: C.muted }}>{formatDateTime(p.created_at)} · {formatMZN(p.total)}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
