import { router, useLocalSearchParams } from "expo-router";
import { KeyRound, MessageSquareText, Phone, ShieldCheck, UserRound } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogoMark } from "../components/brand";
import { ProfileForm } from "../components/profile-form";
import { Alert, Button, Card, Field, PageTitle, Steps } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { registerPush } from "../lib/push";
import { isValidPhone, normalizePhone } from "../lib/format";
import { t } from "../lib/i18n";
import type { Me } from "../lib/me";
import { C, F } from "../theme";

type Step = "phone" | "code" | "profile";

/**
 * Criar conta (ou entrar): número -> código por SMS -> dados pessoais.
 * Quem já tem o perfil preenchido salta o último passo.
 */
export default function Cadastro() {
  const top = useSafeAreaInsets().top;
  const { entrar } = useLocalSearchParams<{ entrar?: string }>();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [demo, setDemo] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const idx = { phone: 0, code: 1, profile: 2 }[step];

  async function request() {
    if (!isValidPhone(phone)) return setError(`${t("Verifique o que escreveu.")} (84 123 4567)`);
    setBusy(true);
    setError("");
    try {
      const r = await api<{ demo_code?: string }>("/api/auth/otp/request", { body: { phone: normalizePhone(phone) } });
      setDemo(r.demo_code ?? "");
      setStep("code");
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
      registerPush().catch(() => {});
      const m = await api<Me>("/api/me");
      if (m.first_name && m.province && m.district) return router.replace("/");
      setMe(m);
      setStep("profile");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Step, [string, string]> = {
    phone: [t(entrar ? "Entre com o seu número" : "Criar conta"), t("Enviamos um código por SMS para confirmar que o número é seu.")],
    code: [t("Confirme o código"), `${t("Enviámos um código para")} ${phone}.`],
    profile: [t("Os seus dados"), t("Para os comprovativos e lembretes da sua zona.")],
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.canvas }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: top + 16, paddingHorizontal: 18, paddingBottom: 48, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <LogoMark size={34} />
          {step !== "profile" ? (
            <Pressable accessibilityRole="button" onPress={() => router.replace("/")} hitSlop={8}>
              <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.muted }}>{t("Agora não")}</Text>
            </Pressable>
          ) : null}
        </View>
        <Steps steps={[t("Número"), t("Código"), t("Dados")]} current={idx} />
        <PageTitle title={titles[step][0]} sub={titles[step][1]} />
        {error ? <Alert>{error}</Alert> : null}

        {step === "phone" && (
          <Card style={{ gap: 14 }}>
            <Field label={t("Número de telefone")} keyboardType="phone-pad" placeholder="84 123 4567" value={phone} onChangeText={setPhone} autoComplete="tel" autoFocus />
            <Button onPress={request} busy={busy} icon={MessageSquareText}>{t("Receber código")}</Button>
          </Card>
        )}

        {step === "code" && (
          <Card style={{ gap: 14 }}>
            {demo ? <Alert tone="info">{`Demo: ${demo}`}</Alert> : null}
            <Field label={t("Código de 6 algarismos")} keyboardType="number-pad" maxLength={6} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
              autoComplete="sms-otp" mono autoFocus style={{ textAlign: "center", letterSpacing: 8, fontSize: 22 }} />
            <Button onPress={verify} busy={busy} disabled={code.length !== 6} icon={KeyRound}>{t("Confirmar")}</Button>
            <Button variant="ghost" onPress={() => { setStep("phone"); setCode(""); }}>{t("Mudar de número")}</Button>
          </Card>
        )}

        {step === "profile" && me ? (
          <ProfileForm initial={me} cta={t("Concluir")} onSaved={() => router.replace("/")} />
        ) : null}

        <View style={{ gap: 10 }}>
          {[[Phone, "Sem palavra-passe: entra sempre com o seu número."], [ShieldCheck, "Os seus dados não são partilhados com terceiros."], [UserRound, "Pode pagar sem conta; a conta guarda o histórico."]].map(([I, txt]) => {
            const Icon = I as typeof Phone;
            return (
              <View key={String(txt)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon size={16} color={C.muted} />
                <Text style={{ flex: 1, fontFamily: F.body, fontSize: 13, color: C.muted }}>{t(String(txt))}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
