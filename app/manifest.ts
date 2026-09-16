import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "구구단 레벨업",
    short_name: "구구단 레벨업",
    description: "구구단 2단~19단 4단계 레벨업 승급 시험",
    start_url: "/",
    display: "standalone",
    background_color: "#4FC3F7",
    theme_color: "#4FC3F7",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
