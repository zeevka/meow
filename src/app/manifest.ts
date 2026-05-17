import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MEOW",
    short_name: "MEOW",
    description: "Shared grocery lists with realtime sync and a warm editorial feel.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4eee4",
    theme_color: "#526244",
    lang: "en",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}

