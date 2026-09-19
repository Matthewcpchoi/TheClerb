import type { MetadataRoute } from "next";

/**
 * Installing to the home screen should open the app chromeless, not as a
 * browser tab. `display: standalone` is what does that; iOS additionally
 * needs the apple-mobile-web-app meta tags set in the root layout.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Clerb",
    short_name: "Clerb",
    description: "A book club, kept properly.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff5e7",
    theme_color: "#fff5e7",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
