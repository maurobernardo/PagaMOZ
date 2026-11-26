import { Check, ChevronDown, Search } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, F, R } from "../theme";

/** Campo de escolha: abre uma folha com a lista (e pesquisa quando a lista é longa). */
export function Picker({ label, value, options, onChange, placeholder, error, disabled }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; placeholder: string; error?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const bottom = useSafeAreaInsets().bottom;
  const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const list = q ? options.filter((o) => plain(o).includes(plain(q))) : options;

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: F.semi, fontSize: 14, color: C.ink }}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={() => { setQ(""); setOpen(true); }}
        style={{ minHeight: 54, borderRadius: R.field, borderWidth: 1.5, borderColor: error ? C.accent : C.line, backgroundColor: C.surface, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", opacity: disabled ? 0.5 : 1 }}>
        <Text style={{ flex: 1, fontFamily: F.semi, fontSize: 17, color: value ? C.ink : C.muted }}>{value || placeholder}</Text>
        <ChevronDown size={18} color={C.muted} />
      </Pressable>
      {error ? <Text style={{ fontFamily: F.semi, fontSize: 13, color: C.accent }}>{error}</Text> : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} onPress={() => setOpen(false)} />
        <View style={{ maxHeight: "75%", backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingBottom: bottom + 10 }}>
          <View style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: C.line, marginBottom: 12 }} />
          <Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink, paddingHorizontal: 20, marginBottom: 10 }}>{label}</Text>
          {options.length > 10 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, borderRadius: R.pill, backgroundColor: C.soft }}>
              <Search size={18} color={C.muted} />
              <TextInput value={q} onChangeText={setQ} placeholder={placeholder} placeholderTextColor={C.muted} autoFocus
                style={{ flex: 1, minHeight: 46, fontFamily: F.body, fontSize: 16, color: C.ink }} />
            </View>
          ) : null}
          <FlatList data={list} keyExtractor={(o) => o} keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: item === value }} onPress={() => { onChange(item); setOpen(false); }}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 15, backgroundColor: pressed ? C.soft : "transparent" })}>
                <Text style={{ fontFamily: item === value ? F.bold : F.body, fontSize: 16, color: C.ink }}>{item}</Text>
                {item === value ? <Check size={18} color={C.ink} /> : null}
              </Pressable>
            )} />
        </View>
      </Modal>
    </View>
  );
}
