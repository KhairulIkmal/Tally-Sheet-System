import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lam Soon Tally Sheet",
    short_name: "Tally Sheet",
    description: "Count Tally Sheet for goods leaving the warehouse.",
    start_url: "/worker",
    display: "standalone",
    background_color: "#f3f4f1",
    theme_color: "#1e4fa3",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
