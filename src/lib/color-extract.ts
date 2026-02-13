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

export function extractDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(getRandomWarmColor());
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(getRandomWarmColor());
          return;
        }

        canvas.width = 1;
        canvas.height = 1;
        ctx.drawImage(img, 0, 0, 1, 1);
        const pixel = ctx.getImageData(0, 0, 1, 1).data;

        // Darken the color for spine readability
        const r = Math.max(0, pixel[0] - 40);
        const g = Math.max(0, pixel[1] - 40);
        const b = Math.max(0, pixel[2] - 40);

        resolve(`rgb(${r}, ${g}, ${b})`);
      } catch {
        resolve(getRandomWarmColor());
      }
    };

    img.onerror = () => {
      resolve(getRandomWarmColor());
    };

    img.src = imageUrl;
  });
}

export function getRandomWarmColor(): string {
  return WARM_PALETTE[Math.floor(Math.random() * WARM_PALETTE.length)];
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
