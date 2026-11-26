"use client";

import { ArrowUp, Mic, ShieldAlert, Sparkles, Volume2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { csrfToken } from "@/lib/api";

type Action = { type: "service" | "payment" | "open"; label: string; service?: number; fields?: Record<string, string>; amount?: number | null; reference?: string; path?: string };
type Msg = { from: "me" | "bot"; text: string; actions?: Action[]; suggestions?: string[]; scam?: { level: string; reasons: string[] } };

const START: Msg = {
  from: "bot",
  text: "Olá! Diga-me o que quer pagar ou pergunte o que vence esta semana. Eu preparo; o pagamento confirma-o sempre você.",
  suggestions: ["Paga 500 de Credelec", "O que vence esta semana?", "Recarga Movitel 100", "Isto é burla?"],
};

/** Assistente por texto (regras + pesquisa inteligente, sem custos). Prepara o pagamento; nunca paga sozinho. */
export default function Assistente() {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([START]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  useEffect(() => setCanListen(typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)), []);

  // Voz do próprio browser (gratuita): falar o pedido e ouvir a resposta.
  function listen() {
    const W = window as unknown as Record<string, new () => { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void; onend: () => void; start: () => void }>;
    const Rec = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = "pt-PT";
    rec.interimResults = false;
    rec.onresult = (e) => send(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }
  function speak(t: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "pt-PT";
    window.speechSynthesis.speak(u);
  }
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [msgs]);

  async function send(message: string) {
    const m = message.trim();
    if (!m || busy) return;
    setText("");
    setMsgs((x) => [...x, { from: "me", text: m }]);
    setBusy(true);
    try {
      const res = await fetch("/api/intel/assistant", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken() }, body: JSON.stringify({ message: m }) });
      const r = await res.json();
      setMsgs((x) => [...x, res.ok ? { from: "bot", text: r.reply, actions: r.actions, suggestions: r.suggestions, scam: r.scam } : { from: "bot", text: r.detail ?? "Não consegui responder." }]);
    } catch {
      setMsgs((x) => [...x, { from: "bot", text: "Sem ligação. Tente de novo." }]);
    } finally {
      setBusy(false);
    }
  }

  function run(a: Action) {
    if (a.type === "service" && a.service) {
      const q = new URLSearchParams({ ...(a.fields ?? {}), ...(a.amount ? { valor: String(a.amount / 100) } : {}) });
      router.push(`/servicos/${a.service}?${q}`);
    } else if (a.type === "payment" && a.reference) router.push(`/pagamento/${a.reference}`);
    else if (a.path === "/contas") router.push("/conta");
    else if (a.path) router.push(a.path);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Eyebrow icon={Sparkles}>Assistente</Eyebrow>
        <h1 className="mt-4 text-4xl font-bold">Diga o que quer pagar</h1>
        <p className="mt-2 text-muted">Em português simples. Eu encontro o serviço e preparo o pagamento.</p>
      </div>
      <div className="flex min-h-[50vh] flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-white p-5">
        {msgs.map((m, i) => (
          <div key={i} className={`flex flex-col gap-2 ${m.from === "me" ? "items-end" : "items-start"}`}>
            <div className={`max-w-[85%] rounded-3xl px-4 py-3 text-[15px] leading-relaxed ${m.from === "me" ? "rounded-br-md bg-ink text-white" : "rounded-bl-md bg-canvas"}`}>
              {m.text}
              {m.from === "bot" ? (
                <button type="button" onClick={() => speak(m.text)} aria-label="Ouvir resposta" className="frame-none ml-2 inline-grid h-7 w-7 place-items-center rounded-full align-middle text-muted hover:bg-white hover:text-ink">
                  <Volume2 className="h-4 w-4" />
                </button>
              ) : null}
              {m.scam?.reasons.length ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {m.scam.reasons.map((r) => <li key={r} className="flex gap-2"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{r}</li>)}
                </ul>
              ) : null}
            </div>
            {m.actions?.length ? (
              <div className="flex flex-wrap gap-2">
                {m.actions.map((a, k) => (
                  <button key={k} type="button" onClick={() => run(a)}
                    className={`frame-none min-h-10 rounded-full px-4 text-sm font-semibold ${k === 0 ? "bg-ink text-white hover:bg-ink/85" : "border border-line bg-white hover:border-ink"}`}>{a.label}</button>
                ))}
              </div>
            ) : null}
            {m.suggestions?.length && i === msgs.length - 1 ? (
              <div className="flex flex-wrap gap-2">
                {m.suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="frame-none min-h-9 rounded-full border border-line px-3 text-sm font-semibold hover:border-ink">{s}</button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {busy ? <p className="text-sm text-muted">A pensar…</p> : null}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="glass sticky bottom-4 flex items-center gap-2 rounded-full p-2">
        <label htmlFor="msg" className="sr-only">Mensagem</label>
        <input id="msg" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: paga 500 de Credelec da casa da mãe" autoComplete="off"
          className="min-h-11 min-w-0 flex-1 bg-transparent px-4 text-base focus:outline-none" />
        {canListen ? (
          <button type="button" onClick={listen} aria-label="Falar" className={`frame-none grid h-11 w-11 shrink-0 place-items-center rounded-full ${listening ? "bg-accent text-white" : "bg-white text-ink"}`}>
            <Mic className="h-5 w-5" />
          </button>
        ) : null}
        <button type="submit" aria-label="Enviar" disabled={!text.trim() || busy} className="frame-none grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-40">
          <ArrowUp className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
