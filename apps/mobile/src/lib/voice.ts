import * as Speech from "expo-speech";
import { lang } from "./i18n";

/** Lê em voz alta (voz do próprio telemóvel, gratuita). Útil para quem tem dificuldade em ler. */
export function speak(text: string) {
  Speech.stop();
  Speech.speak(text, { language: lang === "en" ? "en-US" : "pt-PT", rate: 0.95 });
}

/** Códigos lidos algarismo a algarismo, em grupos ("9565 7430" -> "9 5 6 5, 7 4 3 0"). */
export const spell = (code: string) => code.split(/\s+/).map((g) => g.split("").join(" ")).join(", ");
