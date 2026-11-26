import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { api, errorMessage } from "./api";

export type MethodHealth = { method: string; ok: number; failed: number; rate: number | null; state: "bom" | "instavel" | "falhas" | "sem_dados"; recommended: boolean };

/** Saúde dos métodos na última hora (actualiza ao abrir o passo de pagar). */
export function useMethodHealth(active: boolean) {
  const [data, setData] = useState<Record<string, MethodHealth>>({});
  useEffect(() => {
    if (!active) return;
    api<MethodHealth[]>("/api/intel/methods")
      .then((rows) => setData(Object.fromEntries(rows.map((r) => [r.method, r]))))
      .catch(() => {});
  }, [active]);
  return data;
}

export type Bill = {
  service: number; service_name: string; institution_name: string; institution_slug: string; key: string;
  times: number; last_date: string; last_amount: number; payload: Record<string, string>;
  every_days?: number; typical_amount?: number; next_date?: string; days_left?: number | null;
  daily?: number | null; monthly?: number; explain: string;
};
export type Bills = { recurring: Bill[]; credelec: Bill[] };

/** Abre o serviço com os dados já preenchidos (de uma fatura lida ou de uma conta recorrente). */
export function openPrefilled(service: number, fields: Record<string, string>, amount?: number | null, origin = "") {
  router.push({
    pathname: "/servico/[id]",
    params: { id: String(service), prefill: JSON.stringify(fields), ...(amount ? { valor: String(amount / 100) } : {}), ...(origin ? { origem: origin } : {}) },
  });
}

/** Fotografa (ou escolhe) uma fatura, envia para leitura e abre o pagamento pré-preenchido. */
export async function scanBill(camera: boolean): Promise<string | null> {
  if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return "Autorize a câmara nas definições do telemóvel.";
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.85 };
  const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  const a = r.assets?.[0];
  if (r.canceled || !a) return null;
  const fd = new FormData();
  if (Platform.OS === "web") fd.append("image", await (await fetch(a.uri)).blob(), "fatura.jpg");
  else fd.append("image", { uri: a.uri, name: "fatura.jpg", type: a.mimeType ?? "image/jpeg" } as unknown as Blob);
  try {
    const res = await api<{ service: number | null; fields: Record<string, string>; amount: number | null; confidence: number }>("/api/intel/scan", { form: fd });
    if (!res.service) return "Não reconhecemos esta fatura. Tente com mais luz e a fatura inteira na foto.";
    openPrefilled(res.service, res.fields, res.amount, "fatura");
    return null;
  } catch (e) {
    return errorMessage(e);
  }
}
