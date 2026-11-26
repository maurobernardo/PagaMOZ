"use client";

import { Phone, RotateCcw, Send } from "lucide-react";
import { useState } from "react";
import { Eyebrow } from "@/components/eyebrow";

/**
 * Simulador do menu USSD (*…#): faz o mesmo pedido que o agregador da operadora faria a /api/ussd.
 * Serve para testar o fluxo de quem não tem smartphone nem internet.
 */
export default function UssdSimulator() {
  const [phone, setPhone] = useState("841234567");
  const [steps, setSteps] = useState<string[] | null>(null);
  const [screen, setScreen] = useState("Marque *123# para começar.");
  const [input, setInput] = useState("");
  const [ended, setEnded] = useState(false);

  async function call(next: string[]) {
    const body = new URLSearchParams({ sessionId: "sim", serviceCode: "*123#", phoneNumber: `+258${phone.replace(/\D/g, "").slice(-9)}`, text: next.join("*") });
    const res = await fetch("/api/ussd", { method: "POST", body });
    const text = await res.text();
    setSteps(next);
    setEnded(text.startsWith("END"));
    setScreen(text.replace(/^(CON|END) /, ""));
    setInput("");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Eyebrow icon={Phone}>Sem internet</Eyebrow>
      <h1 className="mt-4 text-4xl font-bold">Simulador USSD</h1>
      <p className="mt-2 max-w-xl text-muted">O mesmo menu que aparece num telemóvel simples ao marcar o código PagaMOZ. Os pagamentos são reais na demonstração (simulador do provedor).</p>

      <div className="mt-8 grid gap-8 md:grid-cols-[320px_1fr]">
        <div className="mx-auto w-[300px] rounded-[2.5rem] bg-ink p-5 shadow-2xl">
          <div className="min-h-64 whitespace-pre-line rounded-2xl bg-[#c8d4b8] p-4 font-mono text-sm leading-relaxed text-[#1d2a12]">{screen}</div>
          <form onSubmit={(e) => { e.preventDefault(); if (steps === null) call([]); else if (!ended && input.trim()) call([...steps, input.trim()]); }} className="mt-4 flex gap-2">
            <label htmlFor="ussd-in" className="sr-only">Resposta</label>
            <input id="ussd-in" value={input} onChange={(e) => setInput(e.target.value)} disabled={steps === null || ended} inputMode="numeric"
              className="min-h-11 min-w-0 flex-1 rounded-xl bg-white/10 px-3 font-mono text-white placeholder:text-white/40 focus:outline-none disabled:opacity-40" placeholder={steps === null ? "" : "Resposta"} />
            <button type="submit" aria-label={steps === null ? "Marcar" : "Enviar"} className="frame-none grid h-11 w-11 place-items-center rounded-xl bg-white text-ink">
              {steps === null ? <Phone className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
          {steps !== null ? (
            <button type="button" onClick={() => { setSteps(null); setEnded(false); setScreen("Marque *123# para começar."); }}
              className="frame-none mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm text-white/70 hover:text-white">
              <RotateCcw className="h-4 w-4" /> Terminar sessão
            </button>
          ) : null}
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <label htmlFor="ussd-phone" className="block font-semibold">Número de quem marca</label>
            <input id="ussd-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel"
              className="mt-1.5 block min-h-12 w-full rounded-2xl border border-line bg-white px-4 font-mono" />
            <p className="mt-1.5 text-muted">84/85 paga com M-Pesa, 86/87 com e-Mola, 82/83 com mKesh.</p>
          </div>
          <div className="rounded-2xl bg-canvas p-4">
            <p className="font-semibold">Para ligar a uma operadora</p>
            <p className="mt-1 text-muted">O agregador USSD envia <code>sessionId</code>, <code>phoneNumber</code> e <code>text</code> para <code>POST /api/ussd</code> e mostra a resposta. É preciso contratar o código curto com a operadora ou um agregador.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
