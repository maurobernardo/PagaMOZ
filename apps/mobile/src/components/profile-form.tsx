import { Save } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { api, errorMessage, fieldErrors } from "../lib/api";
import { t } from "../lib/i18n";
import { DISTRICTS, PROVINCES, type Me } from "../lib/me";
import { AvatarPicker } from "./avatar";
import { Picker } from "./picker";
import { Alert, Button, Card, Field } from "./ui";

/** Nome, apelido, email, província e distrito (listas oficiais). Usado no cadastro e em "Editar perfil". */
export function ProfileForm({ initial, onSaved, cta }: { initial: Partial<Me>; onSaved: () => void; cta?: string }) {
  const [f, setF] = useState({
    first_name: initial.first_name ?? "", last_name: initial.last_name ?? "", email: initial.email ?? "",
    province: initial.province ?? "", district: initial.district ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatar, setAvatar] = useState(initial.avatar ?? "");

  async function save() {
    const errs: Record<string, string> = {};
    if (f.first_name.trim().length < 2) errs.first_name = t("Preencha este campo.");
    if (f.last_name.trim().length < 2) errs.last_name = t("Preencha este campo.");
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) errs.email = t("Verifique o que escreveu.");
    if (!f.province) errs.province = t("Escolha a província");
    if (!f.district) errs.district = t("Escolha o distrito");
    setErrors(errs);
    if (Object.keys(errs).length) return setError(t("Corrija os campos assinalados."));
    setBusy(true);
    setError("");
    try {
      await api("/api/me", { method: "PATCH", body: f });
      onSaved();
    } catch (e) {
      setErrors(fieldErrors(e));
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      {initial.phone ? (
        <AvatarPicker me={{ ...(initial as Me), ...f, avatar }} onChange={setAvatar} onError={setError} />
      ) : null}
      {error ? <Alert>{error}</Alert> : null}
      <Card style={{ gap: 14 }}>
        <Field label={t("Nome")} value={f.first_name} onChangeText={(v) => setF({ ...f, first_name: v })} autoComplete="given-name" error={errors.first_name} />
        <Field label={t("Apelido")} value={f.last_name} onChangeText={(v) => setF({ ...f, last_name: v })} autoComplete="family-name" error={errors.last_name} />
        <Field label={t("Email (opcional)")} value={f.email} onChangeText={(v) => setF({ ...f, email: v.trim() })} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email} />
      </Card>
      <Card style={{ gap: 14 }}>
        <Picker label={t("Província")} placeholder={t("Escolha a província")} value={f.province} options={PROVINCES} error={errors.province}
          onChange={(v) => setF({ ...f, province: v, district: DISTRICTS[v]?.includes(f.district) ? f.district : "" })} />
        <Picker label={t("Distrito")} placeholder={t("Escolha o distrito")} value={f.district} options={DISTRICTS[f.province] ?? []} error={errors.district}
          disabled={!f.province} onChange={(v) => setF({ ...f, district: v })} />
      </Card>
      <Button icon={Save} busy={busy} onPress={save}>{cta ?? t("Guardar")}</Button>
    </View>
  );
}
