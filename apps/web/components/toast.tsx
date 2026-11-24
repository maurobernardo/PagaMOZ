"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";

type Tone = "ok" | "bad" | "info";
type Toast = { id: number; tone: Tone; text: string };
const Ctx = createContext<(text: string, tone?: Tone) => void>(() => {});

/** toast("Guardado.") / toast("Falhou.", "bad") — feedback curto, anunciado a leitores de ecrã. */
export const useToast = () => useContext(Ctx);

const ICON = { ok: CheckCircle2, bad: XCircle, info: Info };

export function Toaster({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Tone = "ok") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, tone, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end">
        {items.map((t) => {
          const I = ICON[t.tone];
          return (
            <div key={t.id} role={t.tone === "bad" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm animate-rise items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-2xl">
              <I className={`mt-0.5 h-4 w-4 shrink-0 ${t.tone === "bad" ? "text-accent" : "text-white/70"}`} />
              <p className="flex-1">{t.text}</p>
              <button aria-label="Fechar" className="text-white/50 hover:text-white" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}>
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
