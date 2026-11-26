import Constants from "expo-constants";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  Bell, Bookmark, FileText, Fingerprint, UserX, HelpCircle, Info, Languages, LogOut, Moon, Shield, MessageCircle, Trash2, User, Vibrate,
} from "lucide-react-native";
import { useState } from "react";
import { registerPush, unregisterPush } from "../../lib/push";
import { Alert as RNAlert, Platform, ScrollView, Text, View } from "react-native";
import { Alert, Group, ListRow, PageTitle, Segmented, Toggle } from "../../components/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, Pencil, UserPlus } from "lucide-react-native";
import { Pressable } from "react-native";
import { shortName } from "../../lib/me";
import { Avatar } from "../../components/avatar";
import { R, shadow } from "../../theme";
import { api, errorMessage, WEB } from "../../lib/api";
import { t } from "../../lib/i18n";
import { useMe } from "../../lib/me";
import { DEFAULT_PREFS, usePrefs, type Lang, type ThemePref } from "../../lib/prefs";
import { ONBOARDED, setItem } from "../../lib/storage";
import { C, F } from "../../theme";

export default function Definicoes() {
  const top = useSafeAreaInsets().top;
  const { prefs, set } = usePrefs();
  const { me, setMe } = useMe();
  const [msg, setMsg] = useState("");

  async function toggleBiometric(on: boolean) {
    if (!on) return set({ biometric: false });
    const ok = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
    if (!ok) return setMsg("Este telemóvel não tem impressão digital ou rosto configurados.");
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: "PagaMOZ" });
    if (r.success) set({ biometric: true });
  }

  async function toggleNotify(on: boolean) {
    if (on && Platform.OS !== "web") {
      const { granted } = await Notifications.requestPermissionsAsync();
      if (!granted) return setMsg("Autorize as notificações nas definições do telemóvel.");
    }
    set({ notifyPayments: on });
    if (on) {
      const r = await registerPush();
      if (r === "sem projecto EAS") setMsg(t("Avisos com a app fechada precisam da versão instalada da app (não o Expo Go)."));
    }
  }

  // Apagar a conta (exigido pelas lojas): confirma duas vezes, porque não se pode desfazer.
  function deleteAccount() {
    RNAlert.alert(t("Apagar a minha conta"), t("Os seus dados pessoais são apagados e sai da conta. Os comprovativos dos pagamentos continuam válidos. Isto não se pode desfazer."), [
      { text: t("Cancelar"), style: "cancel" },
      { text: t("Apagar"), style: "destructive", onPress: async () => {
        await unregisterPush();
        try {
          await api("/api/me", { method: "DELETE" });
          setMe(null);
          setMsg(t("A sua conta foi apagada."));
        } catch (e) {
          setMsg(errorMessage(e));
        }
      } },
    ]);
  }

  async function wipe() {
    await unregisterPush(); await api("/api/auth/logout", { body: {} }).catch(() => {});
    await setItem(ONBOARDED, "");
    setMe(null);
    set({ ...DEFAULT_PREFS });
    setMsg(t("Dados apagados."));
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingTop: top + 16, paddingHorizontal: 18, gap: 22, paddingBottom: 120 }}>
        <PageTitle title={t("Definições")} />
        {msg ? <Alert tone="info">{msg}</Alert> : null}

        {/* Perfil no topo: um toque e está no perfil completo */}
        {me ? (
          <Pressable accessibilityRole="button" onPress={() => router.push("/perfil")}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.surface, borderRadius: R.card, padding: 16, transform: [{ scale: pressed ? 0.985 : 1 }], ...shadow() })}>
            <Avatar me={me} size={58} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.display, fontSize: 18, color: C.ink }} numberOfLines={1}>{shortName(me)}</Text>
              <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted }}>{t("Ver perfil, gráficos e histórico")}</Text>
            </View>
            <ChevronRight size={20} color={C.ink} />
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => router.push("/cadastro")}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.hero, borderRadius: R.card, padding: 18, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
              <UserPlus size={22} color={C.onHero} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.display, fontSize: 18, color: C.onHero }}>{t("Criar conta ou entrar")}</Text>
              <Text style={{ fontFamily: F.body, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{t("Guarde o histórico e os comprovativos.")}</Text>
            </View>
            <ChevronRight size={20} color={C.onHero} />
          </Pressable>
        )}
        {me ? (
          <Group title={t("Conta")}>
            <ListRow first icon={Pencil} title={t("Editar perfil")} sub={[me.district, me.province].filter(Boolean).join(", ") || undefined} onPress={() => router.push("/perfil-editar")} />
            <ListRow icon={Bookmark} title={t("Contas guardadas")} sub={t("Ex.: «casa da mãe», para pagar num toque")} onPress={() => router.push("/carteira")} />
          </Group>
        ) : null}

        <Group title={t("Aparência")}>
          <View style={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Moon size={18} color={C.ink} />
              <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.ink }}>{t("Tema")}</Text>
            </View>
            <Segmented<ThemePref> value={prefs.theme} onChange={(v) => set({ theme: v })}
              options={[{ key: "system", label: t("Automático") }, { key: "light", label: t("Claro") }, { key: "dark", label: t("Escuro") }]} />
          </View>
          <View style={{ padding: 16, gap: 12, borderTopWidth: 1, borderColor: C.line }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Languages size={18} color={C.ink} />
              <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.ink }}>{t("Idioma")}</Text>
            </View>
            <Segmented<Lang> value={prefs.lang} onChange={(v) => set({ lang: v })}
              options={[{ key: "pt", label: "Português" }, { key: "en", label: "English" }]} />
          </View>
        </Group>

        <Group title={t("Notificações")}>
          <ListRow first icon={Bell} title={t("Pagamentos confirmados")} right={<Toggle label={t("Pagamentos confirmados")} value={prefs.notifyPayments} onChange={toggleNotify} />} />
        </Group>

        <Group title={t("Segurança")}>
          {Platform.OS !== "web" ? (
            <ListRow first icon={Fingerprint} title={t("Pedir biometria ao abrir")} right={<Toggle label={t("Pedir biometria ao abrir")} value={prefs.biometric} onChange={toggleBiometric} />} />
          ) : null}
          <ListRow first={Platform.OS === "web"} icon={Vibrate} title={t("Vibração ao tocar")} right={<Toggle label={t("Vibração ao tocar")} value={prefs.haptics} onChange={(v) => set({ haptics: v })} />} />
        </Group>

        <Group title={t("Privacidade")}>
          <ListRow first icon={Shield} title={t("Política de privacidade")} onPress={() => router.push("/privacidade")} />
          <ListRow icon={FileText} title={t("Termos de utilização")} onPress={() => router.push("/termos")} />
          <ListRow icon={Trash2} title={t("Apagar dados deste aparelho")} danger onPress={wipe} />
          {me ? <ListRow icon={UserX} title={t("Apagar a minha conta")} danger onPress={deleteAccount} /> : null}
        </Group>

        <Group title={t("Ajuda")}>
          <ListRow first icon={HelpCircle} title={t("Perguntas frequentes")} onPress={() => WebBrowser.openBrowserAsync(`${WEB}/#faq`)} />
          <ListRow icon={MessageCircle} title={t("Ver boas-vindas outra vez")} onPress={async () => { await setItem(ONBOARDED, ""); router.replace("/bem-vindo"); }} />
        </Group>

        <Group title={t("Sobre")}>
          <ListRow first icon={Info} title="PagaMOZ" sub={`${t("Versão")} ${Constants.expoConfig?.version ?? "1.0.0"}`} />
          <ListRow icon={Info} title={t("Fotografia do início")} sub="Shixart1985, CC BY 2.0 (Wikimedia Commons), editada" />
        </Group>

        {me ? (
          <Group>
            <ListRow first icon={LogOut} title={t("Sair")} danger onPress={async () => { await unregisterPush(); await api("/api/auth/logout", { body: {} }).catch(() => {}); setMe(null); }} />
          </Group>
        ) : null}
      </ScrollView>
    </View>
  );
}
