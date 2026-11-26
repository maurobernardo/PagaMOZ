import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";

/**
 * Converte qualquer foto (incluindo HEIC do iPhone) para JPEG e reduz a largura.
 * O servidor só precisa de ler JPEG, e o envio fica leve em redes lentas.
 */
export async function toJpeg(uri: string, width: number): Promise<{ uri: string; name: string; type: string }> {
  if (Platform.OS === "web") return { uri, name: "foto.jpg", type: "image/jpeg" };
  const ctx = ImageManipulator.manipulate(uri).resize({ width });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return { uri: out.uri, name: "foto.jpg", type: "image/jpeg" };
}
