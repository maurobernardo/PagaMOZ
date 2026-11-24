import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Tone = "ok" | "wait" | "bad" | "info";

const TONE: Record<Tone, string> = {
  ok: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  wait: "bg-amber-50 text-amber-900 ring-amber-600/25",
  bad: "bg-red-50 text-red-800 ring-red-600/20",
  info: "bg-sky-50 text-sky-900 ring-sky-600/20",
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE[tone]}`}>
      {children}
    </span>
  );
}

const BTN =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold transition " +
  "focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600 " +
  "disabled:cursor-not-allowed disabled:opacity-60";
const VARIANT = {
  primary: "bg-brand-700 text-white hover:bg-brand-800",
  secondary: "bg-white text-brand-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
};

export function Button({
  variant = "primary",
  className = "",
  ...p
}: ComponentProps<"button"> & { variant?: keyof typeof VARIANT }) {
  return <button className={`${BTN} ${VARIANT[variant]} ${className}`} {...p} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...p
}: ComponentProps<typeof Link> & { variant?: keyof typeof VARIANT }) {
  return <Link className={`${BTN} ${VARIANT[variant]} ${className}`} {...p} />;
}

export function Field({
  label,
  hint,
  error,
  id,
  ...input
}: ComponentProps<"input"> & { label: string; hint?: string; error?: string; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className="mt-1 block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30 aria-[invalid=true]:border-red-600"
        {...input}
      />
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-slate-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Card({ className = "", ...p }: ComponentProps<"div">) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`} {...p} />;
}

export function Alert({ tone = "bad", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${TONE[tone]}`}>
      {children}
    </div>
  );
}

export function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-2 ${strong ? "text-lg font-bold text-slate-900" : "text-slate-700"}`}>
      <dt>{label}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{children}</h1>
      {sub ? <p className="mt-1 text-slate-600">{sub}</p> : null}
    </div>
  );
}
