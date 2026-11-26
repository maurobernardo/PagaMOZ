"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { csrfToken } from "@/lib/api";

/** Fotografe e pague: envia a foto da fatura, abre o serviço com os dados lidos (a pessoa revê). */
export function ScanBill({ dark = false }: { dark?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function send(f: File) {
    setBusy(true);
    setMsg("");
    const fd = new FormData();
    fd.set("image", f);
    try {
      const res = await fetch("/api/intel/scan", { method: "POST", body: fd, headers: { "X-CSRFToken": csrfToken() } });
      const b = await res.json();
      if (!res.ok) return setMsg(b.detail ?? "Não foi possível ler a fatura.");
      if (!b.service) return setMsg("Não reconhecemos esta fatura. Tente com mais luz e a fatura inteira na foto.");
      const q = new URLSearchParams({ ...b.fields, origem: "fatura", ...(b.amount ? { valor: String(b.amount / 100) } : {}) });
      router.push(`/servicos/${b.service}?${q}`);
    } catch {
      setMsg("Sem ligação. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => input.current?.click()} disabled={busy}
        className={`frame-none inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold ${dark ? "bg-white/10 text-white hover:bg-white/20" : "bg-ink text-white hover:bg-ink/85"}`}>
        <Camera className="h-4 w-4" /> {busy ? "A ler a fatura…" : "Fotografar fatura"}
      </button>
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Foto da fatura"
        onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
      {msg ? <p className={`mt-2 text-sm ${dark ? "text-white/80" : "text-accent"}`}>{msg}</p> : null}
    </div>
  );
}
