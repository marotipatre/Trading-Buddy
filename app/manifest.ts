import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trading Buddy — NSE paper trading and strategy testing",
    short_name: "Trading Buddy",
    description: "Practise trading NSE stocks with paper money, test strategies on history, and follow a rule book.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f9d73",
    categories: ["finance", "education"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Ideas", url: "/ideas" },
      { name: "Intraday picks", url: "/intraday" },
      { name: "Rule books", url: "/playbook" },
    ],
  };
}
