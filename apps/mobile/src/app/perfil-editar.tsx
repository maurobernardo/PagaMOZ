import { router } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { ProfileForm } from "../components/profile-form";
import { Alert, Header, Loading, PageTitle } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { t } from "../lib/i18n";
import type { Me } from "../lib/me";
import { C } from "../theme";

/** Editar o perfil: nome, apelido, email, província e distrito (listas oficiais). */
export default function Perfil() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Me>("/api/me").then(setMe).catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <Header title={t("Editar perfil")} />
      {!me ? (error ? <View style={{ padding: 16 }}><Alert>{error}</Alert></View> : <Loading />) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            <PageTitle title={t("Perfil")} />
            <ProfileForm initial={me} onSaved={() => router.back()} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
