import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl font-bold text-[#0b3d2e]">PagaMOZ</h1>
      <p className="mt-3 text-lg text-slate-700">
        Pague água, energia, impostos, propinas e documentos num só lugar — e receba um comprovativo verificável.
      </p>
      <p className="mt-8 text-sm text-slate-600">
        Fase 0 — fundações. <Link className="underline" href="/health">Estado do sistema</Link>
      </p>
    </main>
  );
}
