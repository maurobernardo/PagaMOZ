import { router } from "expo-router";
import { Check, Save } from "lucide-react-native";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Alert, Button, Card, Field, Header, Loading, PageTitle } from "../components/ui";
import { api, errorMessage, fieldErrors } from "../lib/api";
import { t } from "../lib/i18n";
import { PROVINCES, type Me } from "../lib/me";
import { C, F, R } from "../theme";

/** Editar o perfil: nome, apelido, email, província e distrito (guardado na API). */
export default function Perfil() {
  const [form, setForm] = useState<Me | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState(false);

  useEffect(() => {
    api<Me>("/api/me").then(setForm).catch((e) => setError(errorMessage(e)));
  }, []);

  async function save() {
    if (!form) return;
    setBusy(true);
    setError("");
    try {
      const { first_name, last_name, email, province, district } = form;
      await api("/api/me", { method: "PATCH", body: { first_name, last_name, email, province, district } });
      router.back();
    } catch (e) {
      setErrors(fieldErrors(e));
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  const set = (k: keyof Me) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <Header title={t("Editar perfil")} />
      {!form ? (error ? <View style={{ padding: 16 }}><Alert>{error}</Alert></View> : <Loading />) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            <PageTitle title={t("Perfil")} />
            {error ? <Alert>{error}</Alert> : null}
            <Card style={{ gap: 14 }}>
              <Field label={t("Nome")} value={form.first_name ?? ""} onChangeText={set("first_name")} autoComplete="given-name" error={errors.first_name} />
              <Field label={t("Apelido")} value={form.last_name ?? ""} onChangeText={set("last_name")} autoComplete="family-name" error={errors.last_name} />
              <Field label={t("Email (opcional)")} value={form.email ?? ""} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email} />
            </Card>
            <Card style={{ gap: 14 }}>
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: F.semi, fontSize: 14, color: C.ink }}>{t("Província")}</Text>
                <Pressable accessibilityRole="button" onPress={() => setPick(!pick)}
                  style={{ minHeight: 54, borderRadius: R.field, borderWidth: 1.5, borderColor: errors.province ? C.accent : C.line, backgroundColor: C.surface, paddingHorizontal: 16, justifyContent: "center" }}>
                  <Text style={{ fontFamily: F.semi, fontSize: 17, color: form.province ? C.ink : C.muted }}>{form.province || t("Escolha a província")}</Text>
                </Pressable>
                {pick ? (
                  <View style={{ borderRadius: R.field, borderWidth: 1, borderColor: C.line, overflow: "hidden" }}>
                    {PROVINCES.map((p, i) => (
                      <Pressable key={p} accessibilityRole="radio" accessibilityState={{ checked: form.province === p }}
                        onPress={() => { set("province")(p); setPick(false); }}
                        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderColor: C.line, backgroundColor: pressed ? C.soft : C.surface })}>
                        <Text style={{ fontFamily: F.body, fontSize: 15, color: C.ink }}>{p}</Text>
                        {form.province === p ? <Check size={18} color={C.ink} /> : null}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
              <Field label={t("Distrito")} value={form.district ?? ""} onChangeText={set("district")} placeholder="KaMpfumo, Matola, Xai-Xai…" error={errors.district} />
            </Card>
            <Button icon={Save} busy={busy} onPress={save}>{t("Guardar")}</Button>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
