"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";

type Tone = "ok" | "wait" | "bad" | "info";

const TONE: Record<Tone, string> = {
  ok: "bg-ink text-white ring-ink",
  wait: "bg-white text-ink ring-ink/20",
  bad: "bg-accent-soft text-accent ring-accent/25",
  info: "bg-canvas text-ink ring-ink/10",
};
const DOT: Record<Tone, string> = { ok: "bg-white", wait: "bg-ink/40", bad: "bg-accent", info: "bg-ink/40" };

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${TONE[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} aria-hidden />
      {children}
    </span>
  );
}

const BTN =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition " +
  "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const VARIANT = {
  primary: "bg-ink text-white hover:bg-ink/85",
  secondary: "bg-white text-ink ring-1 ring-inset ring-ink/15 hover:ring-ink/40",
  ghost: "text-ink hover:bg-ink/5",
  danger: "bg-accent text-white hover:bg-accent/90",
};
type Variant = keyof typeof VARIANT;

export function Button({ variant = "primary", className = "", ...p }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${BTN} ${VARIANT[variant]} ${className}`} {...p} />;
}

export function ButtonLink({ variant = "primary", className = "", ...p }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${BTN} ${VARIANT[variant]} ${className}`} {...p} />;
}

/** Botões agrupados num cartão translúcido (barra de acções). */
export function Toolbar({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`glass inline-flex flex-wrap items-center gap-1.5 rounded-full p-1.5 ${className}`}>{children}</div>;
}

export function Field({ label, hint, error, id, ...input }: ComponentProps<"input"> & { label: string; hint?: string; error?: string; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className="mt-1.5 block min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base text-ink placeholder:text-muted/70 transition focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/5 aria-[invalid=true]:border-accent"
        {...input}
      />
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-sm font-medium text-accent">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Card({ className = "", ...p }: ComponentProps<"div">) {
  return <div className={`rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-[var(--shadow-soft)] ${className}`} {...p} />;
}

export function Alert({ tone = "bad", children }: { tone?: Tone; children: ReactNode }) {
  const cls = tone === "bad" ? "bg-accent-soft text-accent ring-accent/20" : tone === "ok" ? "bg-ink text-white ring-ink" : "bg-white text-ink ring-line";
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={`rounded-2xl px-4 py-3 text-sm font-medium ring-1 ring-inset ${cls}`}>
      {children}
    </div>
  );
}

export function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-2.5 ${strong ? "font-display text-lg font-bold text-ink" : "text-muted"}`}>
      <dt>{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? "" : "text-ink"}`}>{children}</dd>
    </div>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{children}</h1>
      {sub ? <p className="mt-2 text-muted">{sub}</p> : null}
    </div>
  );
}

/** Chip translúcido para contexto ("Portal da instituição · Admin"). */
export function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span className={`${dark ? "glass-dark text-white/80" : "glass text-ink/70"} inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]`}>
      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
      {children}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-ink/5 ${className}`} aria-hidden />;
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-ink/15 bg-white/60 px-6 py-12 text-center">
      {icon ? <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-canvas text-ink">{icon}</div> : null}
      <p className="font-display text-lg font-bold">{title}</p>
      {children ? <div className="mt-1 max-w-sm text-sm text-muted">{children}</div> : null}
    </div>
  );
}

// ---------- Diálogos (substituem prompt/confirm do browser) ----------

type DialogReq = { title: string; body?: string; input?: { label: string; initial?: string; placeholder?: string; multiline?: boolean };
  confirm: string; danger?: boolean; resolve: (v: string | null) => void };

/** const ask = useDialog(); const motivo = await ask.prompt({...}); if (await ask.confirm({...})) ... */
export function useDialog() {
  const [req, setReq] = useState<DialogReq | null>(null);
  const ui = req ? <DialogView req={req} close={() => setReq(null)} /> : null;
  return {
    ui,
    prompt: (o: Omit<DialogReq, "resolve" | "input"> & { input: NonNullable<DialogReq["input"]> }) =>
      new Promise<string | null>((resolve) => setReq({ ...o, resolve })),
    confirm: (o: Omit<DialogReq, "resolve" | "input">) =>
      new Promise<boolean>((resolve) => setReq({ ...o, resolve: (v) => resolve(v !== null) })),
  };
}

function DialogView({ req, close }: { req: DialogReq; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(req.input?.initial ?? "");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const done = (v: string | null) => {
    req.resolve(v);
    close();
  };
  const Input = req.input?.multiline ? "textarea" : "input";
  return (
    <dialog ref={ref} onCancel={() => done(null)} aria-labelledby="dlg-title"
      className="m-auto w-[min(92vw,28rem)] rounded-[var(--radius-card)] border border-line bg-white p-0 text-ink shadow-2xl">
      <form method="dialog" className="p-6" onSubmit={(e) => { e.preventDefault(); if (!req.input || value.trim()) done(value.trim()); }}>
        <h2 id="dlg-title" className="text-xl font-bold">{req.title}</h2>
        {req.body ? <p className="mt-2 text-sm text-muted">{req.body}</p> : null}
        {req.input ? (
          <label className="mt-5 block text-sm font-semibold">
            {req.input.label}
            <Input autoFocus value={value} placeholder={req.input.placeholder} rows={3}
              onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setValue(e.target.value)}
              className="mt-1.5 block min-h-12 w-full rounded-2xl border border-line px-4 py-3 text-base font-normal focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/5" />
          </label>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => done(null)}>Cancelar</Button>
          <Button type="submit" variant={req.danger ? "danger" : "primary"} disabled={!!req.input && !value.trim()}>{req.confirm}</Button>
        </div>
      </form>
    </dialog>
  );
}
