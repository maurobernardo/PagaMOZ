import { api, API_URL } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Health() {
  const { data } = await api.GET("/api/health").catch(() => ({ data: undefined }));
  const rows: [string, string][] = [
    ["web", "ok"],
    ["api", data ? data.status : "erro"],
    ["base de dados", data?.database ?? "—"],
    ["fila", data?.queue ?? "—"],
  ];
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold">Estado do sistema</h1>
      <p className="mt-1 text-sm text-muted">API: {API_URL}</p>
      <dl className="mt-6 divide-y rounded border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between px-4 py-3">
            <dt>{k}</dt>
            <dd className={v === "ok" ? "font-semibold text-green-700" : "font-semibold text-accent"}>{v}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
