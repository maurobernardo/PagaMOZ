import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PagaMOZ",
    short_name: "PagaMOZ",
    description: "Pague serviços, taxas e contas sem ir ao balcão.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0b3d2e",
    lang: "pt-MZ",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
