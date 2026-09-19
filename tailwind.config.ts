import type { Config } from "tailwindcss";

/**
 * Palette is the design's five-colour set, verbatim. No other colours.
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ground: "#fff5e7",
        tan: "#e6d2b6",
        "tan-soft": "#f0e0c6",
        teal: "#2dbba1",
        green: "#009774",
        ink: "#0e5f49",
        muted: "#3d6a58",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        // Every number in this design is monospace.
        num: ["ui-monospace", "Menlo", "Monaco", "monospace"],
      },
      letterSpacing: {
        kicker: "0.16em",
        "kicker-wide": "0.18em",
      },
      borderRadius: {
        cover: "2px 5px 5px 2px",
        spine: "1px 3px 3px 1px",
      },
    },
  },
  plugins: [],
};
export default config;
