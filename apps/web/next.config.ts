import path from "node:path";
import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

// ponytail: 'unsafe-inline' nos scripts porque o Next injecta scripts inline; migrar para nonce via middleware
// quando houver tempo. Tudo o resto fica restrito à própria origem (a API está atrás do mesmo domínio).
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Imagem de produção pequena: só o necessário para correr (sem dependências de desenvolvimento).
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@pagamoz/api-client"],
  poweredByHeader: false,
  async rewrites() {
    // A API Django fica atrás do mesmo domínio: sessão e CSRF sem CORS.
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: CSP },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
