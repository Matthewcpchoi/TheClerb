const WARM_PALETTE = [
  "#8B4513", // Saddle Brown
  "#A0522D", // Sienna
  "#6B3A2A", // Dark Wood
  "#2F4F4F", // Dark Slate
  "#4A3728", // Dark Brown
  "#704214", // Sepia
  "#556B2F", // Dark Olive
  "#800020", // Burgundy
  "#191970", // Midnight Blue
  "#2E1A47", // Deep Purple
  "#3C1518", // Mahogany
  "#1B4332", // Dark Green
  "#7C3030", // Rust Red
  "#4A5568", // Cool Gray
  "#744210", // Dark Gold
];

/**
 * Canvas extraction of a cover's dominant colour is not possible here:
 * books.google.com sends no Access-Control-Allow-Origin header, so a
 * crossOrigin="anonymous" load always fails, and without it the canvas is
 * tainted and getImageData throws. The previous implementation therefore
 * fell through to a random colour on every single call.
 *
 * A stable hash of the title gives each book one consistent colour instead,
 * with no network request to hang on.
 */
export function getDeterministicSpineColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return WARM_PALETTE[Math.abs(hash) % WARM_PALETTE.length];
}

export function getContrastColor(bgColor: string): string {
  // Parse rgb or hex to determine brightness
  let r = 0,
    g = 0,
    b = 0;

  if (bgColor.startsWith("rgb")) {
    const match = bgColor.match(/(\d+)/g);
    if (match) {
      r = parseInt(match[0]);
      g = parseInt(match[1]);
      b = parseInt(match[2]);
    }
  } else if (bgColor.startsWith("#")) {
    const hex = bgColor.replace("#", "");
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  }

  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? "#1a1a1a" : "#F5E6CC";
}
