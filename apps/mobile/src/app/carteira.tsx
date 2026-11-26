import { useFocusEffect } from "expo-router";
import { Bookmark, Check, Pencil, Trash2, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BrandMark } from "../components/brand";
import { Alert, Header, Loading, P, PageTitle } from "../components/ui";
import { api, errorMessage, type Service } from "../lib/api";
import { t } from "../lib/i18n";
import { openPrefilled } from "../lib/intel";
import { C, F, R, shadow } from "../theme";

type Ob = { id: number; label: string; service: number; service_detail: Service; fields: Record<string, string> };

/** Contas guardadas com nome ("casa da mãe"): pagar num toque, renomear, apagar. O assistente usa estes nomes. */
export default function Carteira() {
  const [items, setItems] = useState<Ob[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const load = useCallback(() => {
    api<Ob[]>("/api/me/obligations").then(setItems).catch((e) => setError(errorMessage(e)));
  }, []);
  useFocusEffect(load);

  async function rename(o: Ob) {
    try {
      await api(`/api/me/obligations/${o.id}`, { method: "PATCH", body: { label: label.trim() } });
      setEditing(null);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function remove(o: Ob) {
    await api(`/api/me/obligations/${o.id}`, { method: "DELETE" }).catch((e) => setError(errorMessage(e)));
    load();
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <Header title={t("Contas guardadas")} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <PageTitle title={t("Contas guardadas")} sub={t("Guarde ao pagar, no passo «Confirmar». Depois diga ao assistente: «paga a casa da mãe».")} />
        {error ? <Alert>{error}</Alert> : null}
        {items === null ? <Loading /> : items.length === 0 ? (
          <View style={{ alignItems: "center", gap: 10, padding: 30 }}>
            <Bookmark size={30} color={C.muted} />
            <P muted>{t("Ainda não guardou nenhuma conta.")}</P>
          </View>
        ) : items.map((o) => (
          <View key={o.id} style={{ backgroundColor: C.surface, borderRadius: R.card, padding: 14, gap: 10, ...shadow() }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <BrandMark slug={o.service_detail.institution.slug} name={o.service_detail.institution.name} size={42} round />
              {editing === o.id ? (
                <TextInput value={label} onChangeText={setLabel} autoFocus maxLength={60} accessibilityLabel={t("Nome")}
                  style={{ flex: 1, minHeight: 44, borderRadius: 14, borderWidth: 1.5, borderColor: C.ink, paddingHorizontal: 12, fontFamily: F.semi, fontSize: 15, color: C.ink }} />
              ) : (
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.semi, fontSize: 16, color: C.ink }}>{o.label}</Text>
                  <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }} numberOfLines={1}>{o.service_detail.name} · {Object.values(o.fields).join(" · ")}</Text>
                </View>
              )}
              {editing === o.id ? (
                <>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("Guardar")} onPress={() => rename(o)} hitSlop={8}><Check size={20} color={C.ok} /></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("Cancelar")} onPress={() => setEditing(null)} hitSlop={8}><X size={20} color={C.muted} /></Pressable>
                </>
              ) : (
                <>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("Mudar nome")} onPress={() => { setEditing(o.id); setLabel(o.label); }} hitSlop={8}><Pencil size={18} color={C.muted} /></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("Apagar")} onPress={() => remove(o)} hitSlop={8}><Trash2 size={18} color={C.accent} /></Pressable>
                </>
              )}
            </View>
            <Pressable accessibilityRole="button" onPress={() => openPrefilled(o.service, o.fields)}
              style={{ minHeight: 44, borderRadius: R.pill, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: F.semi, fontSize: 14, color: C.white }}>{t("Pagar")}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
