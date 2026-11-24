import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui";
import { VerificationResult } from "@/components/verification-result";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "Verificar comprovativo", robots: { index: false } };

export default async function VerifyCode({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const { data } = await api
    .GET("/api/receipts/{code}", { params: { path: { code: codigo } }, cache: "no-store" })
    .catch(() => ({ data: undefined }));

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="sr-only">Verificar comprovativo</h1>
      {data ? (
        <VerificationResult v={data} />
      ) : (
        <Alert>
          Não existe nenhum comprovativo com o código <strong className="font-mono">{codigo}</strong>. Confirme o
          código ou o documento pode ser falso.
        </Alert>
      )}
      <p className="mt-6 text-center">
        <Link href="/verificar" className="font-semibold text-brand-800 underline">
          Verificar outro comprovativo
        </Link>
      </p>
    </div>
  );
}
