import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#FDF6EC",
        "cream-dark": "#F5E6CC",
        mahogany: "#3C1518",
        espresso: "#69381A",
        gold: "#C49A3B",
        "gold-light": "#D4B060",
        sage: "#7A8B69",
        "sage-light": "#95A884",
        charcoal: "#2B2B2B",
        "warm-brown": "#8B5E3C",
        "wood-light": "#D4A574",
        "wood-dark": "#6B3A2A",
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        sans: ["Source Sans 3", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
