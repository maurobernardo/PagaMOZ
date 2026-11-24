import type { Metadata } from "next";
import { PortalShell } from "./portal-context";

export const metadata: Metadata = { title: "Portal da instituição", robots: { index: false } };

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PortalShell slug={slug}>{children}</PortalShell>;
}
