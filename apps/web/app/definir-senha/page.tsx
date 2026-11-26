"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { Alert, Button, Field } from "@/components/ui";
import { csrfToken } from "@/lib/api";

/** Link de convite: a própria pessoa escolhe a senha (ninguém mais a vê). */
function DefinirSenha() {
  const q = useSearchParams();
  const uid = q.get("uid") ?? "";
  const token = q.get("token") ?? "";
  const [who, setWho] = useState<{ email: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/set-password?uid=${encodeURIComponent(uid)}&token=${encodeURIComponent(token)}`)
      .then(async (r) => (r.ok ? setWho(await r.json()) : setError((await r.json()).detail ?? "Link inválido.")))
      .catch(() => setError("Sem ligação. Tente de novo."));
  }, [uid, token]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 12) return setError("Use pelo menos 12 caracteres.");
    if (pw !== pw2) return setError("As duas senhas não são iguais.");
    setBusy(true);
    setError("");
    const r = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken() },
      body: JSON.stringify({ uid, token, password: pw }),
    });
    setBusy(false);
    if (r.status === 204) return setDone(true);
    const b = await r.json().catch(() => ({}));
    setError((b.password ?? [b.detail ?? "Não foi possível guardar."]).join(" "));
  }

  return (
    <AuthFrame eyebrow="PagaMOZ" icon={KeyRound} title="Definir a sua senha"
      sub={who ? `${who.name ? who.name + " · " : ""}${who.email}` : "Escolha a senha com que vai entrar."}>
      {error ? <div className="mb-5"><Alert>{error}</Alert></div> : null}
      {done ? (
        <div className="space-y-4">
          <Alert tone="ok">Senha guardada. Já pode entrar com o seu email.</Alert>
          <Link href="/portal" className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink font-semibold text-white">Entrar no portal</Link>
        </div>
      ) : who ? (
        <form onSubmit={save} className="space-y-5" noValidate>
          <input type="email" autoComplete="username" value={who.email} readOnly hidden />
          <Field id="pw" label="Nova senha (mínimo 12 caracteres)" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Field id="pw2" label="Repetir a senha" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          <Button type="submit" disabled={busy} className="w-full !min-h-12">{busy ? "A guardar…" : "Guardar senha"}</Button>
        </form>
      ) : null}
    </AuthFrame>
  );
}

export default function Page() {
  return <Suspense><DefinirSenha /></Suspense>;
}
