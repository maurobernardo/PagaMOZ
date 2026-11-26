import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { api, errorMessage } from "../lib/api";
import { t } from "../lib/i18n";
import { initials, type Me } from "../lib/me";
import { C, F } from "../theme";

/** Foto de perfil num círculo; sem foto mostra as iniciais. */
export function Avatar({ me, size = 44 }: { me: Me; size?: number }) {
  if (me.avatar) return <Image source={{ uri: me.avatar }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" accessibilityLabel={t("Perfil")} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: F.display, fontSize: size * 0.36, color: C.white }}>{initials(me)}</Text>
    </View>
  );
}

/** Avatar grande com botão de câmara: escolher da galeria (ou tirar foto) e enviar para a API. */
export function AvatarPicker({ me, onChange, onError }: { me: Me; onChange: (avatar: string) => void; onError: (msg: string) => void }) {
  const [busy, setBusy] = useState(false);

  async function pick(camera: boolean) {
    // A galeria abre sem pedir permissão (o sistema mostra o seu próprio seletor); a câmara precisa.
    if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted)
      return onError(t("Autorize o acesso às fotos nas definições do telemóvel."));
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const a = r.assets?.[0];
    if (r.canceled || !a) return;
    setBusy(true);
    try {
      const fd = new FormData();
      if (Platform.OS === "web") fd.append("avatar", await (await fetch(a.uri)).blob(), "foto.jpg");
      else fd.append("avatar", { uri: a.uri, name: a.fileName ?? "foto.jpg", type: a.mimeType ?? "image/jpeg" } as unknown as Blob);
      const res = await api<{ avatar: string }>("/api/me/avatar", { form: fd });
      onChange(res.avatar);
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ alignItems: "center", gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Mudar foto")} onPress={() => pick(false)}>
        <Avatar me={me} size={104} />
        <View style={{ position: "absolute", right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: C.ink, borderWidth: 3, borderColor: C.canvas, alignItems: "center", justifyContent: "center" }}>
          {busy ? <ActivityIndicator size="small" color={C.white} /> : <Camera size={16} color={C.white} />}
        </View>
      </Pressable>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <Pressable accessibilityRole="button" onPress={() => pick(false)} hitSlop={6}><Text style={{ fontFamily: F.semi, fontSize: 14, color: C.ink }}>{t("Escolher foto")}</Text></Pressable>
        {Platform.OS !== "web" ? <Pressable accessibilityRole="button" onPress={() => pick(true)} hitSlop={6}><Text style={{ fontFamily: F.semi, fontSize: 14, color: C.ink }}>{t("Tirar foto")}</Text></Pressable> : null}
        {me.avatar ? (
          <Pressable accessibilityRole="button" hitSlop={6} onPress={async () => { await api("/api/me/avatar", { method: "DELETE" }).catch(() => {}); onChange(""); }}>
            <Text style={{ fontFamily: F.semi, fontSize: 14, color: C.accent }}>{t("Remover")}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
