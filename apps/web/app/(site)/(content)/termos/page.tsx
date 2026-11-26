import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/eyebrow";
import { TERMS } from "@/lib/legal";

export const metadata: Metadata = { title: "Termos de utilização" };

export default function Termos() {
  return (
    <div className="mx-auto max-w-3xl">
      <Eyebrow icon={FileText}>{TERMS.updated}</Eyebrow>
      <h1 className="mt-4 text-4xl font-bold">Termos de utilização</h1>
      <div className="mt-8 space-y-4">
        {TERMS.sections.map((s) => (
          <section key={s.title} className="rounded-[var(--radius-card)] border border-line bg-white p-6">
            <h2 className="text-xl font-bold">{s.title}</h2>
            <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
