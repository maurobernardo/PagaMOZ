import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

let registered = "";

/**
 * Regista este telemóvel para notificações push ("Pagamento confirmado").
 * Precisa de: aparelho real, um projecto EAS (extra.eas.projectId no app.json) e uma
 * development build no Android (o Expo Go deixou de receber push no Android na SDK 53).
 * Sem isso devolve o motivo e a app continua com as notificações locais.
 */
export async function registerPush(): Promise<string> {
  if (Platform.OS === "web") return "web";
  if (!Device.isDevice) return "emulador";
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return "sem projecto EAS";
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("pagamentos", { name: "Pagamentos", importance: Notifications.AndroidImportance.HIGH });
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return "sem permissão";
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (token !== registered) {
      await api("/api/me/push-token", { body: { token, platform: Platform.OS } });
      registered = token;
    }
    return "ok";
  } catch {
    return "falhou";
  }
}

/** Ao sair da conta: este telemóvel deixa de receber os avisos dessa conta. */
export async function unregisterPush() {
  if (!registered) return;
  await api("/api/me/push-token", { method: "DELETE", body: { token: registered } }).catch(() => {});
  registered = "";
}
