"use client";

import { Book } from "@/types";
import { getContrastColor } from "@/lib/color-extract";
import Link from "next/link";

interface BookSpineProps {
  book: Book;
  index?: number;
}

export default function BookSpine({ book, index = 0 }: BookSpineProps) {
  const spineColor = book.spine_color || "#3C1518";
  const textColor = getContrastColor(spineColor);

  // Vary heights slightly for realism
  const heights = [220, 235, 210, 240, 225, 215, 230, 245];
  const widths = [42, 48, 38, 50, 44, 40, 46, 52];
  const height = heights[index % heights.length];
  const width = widths[index % widths.length];

  return (
    <Link href={`/book/${book.id}`} className="block">
      <div
        className="book-spine relative cursor-pointer flex-shrink-0 rounded-sm"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: spineColor,
          backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0.15) 0%, rgba(255,255,255,0.05) 30%, rgba(255,255,255,0.08) 50%, rgba(0,0,0,0.1) 100%)`,
          boxShadow: `
            inset -2px 0 4px rgba(0,0,0,0.2),
            inset 2px 0 4px rgba(255,255,255,0.05),
            2px 2px 4px rgba(0,0,0,0.3)
          `,
          transformStyle: "preserve-3d",
          perspective: "500px",
        }}
        title={`${book.title} by ${book.author || "Unknown"}`}
      >
        {/* Spine text */}
        <div
          className="spine-text absolute inset-0 flex items-center justify-center px-1 overflow-hidden"
          style={{ color: textColor }}
        >
          <div className="text-center">
            <p
              className="font-serif text-xs font-bold leading-tight truncate"
              style={{
                fontSize: width < 44 ? "9px" : "10px",
                maxHeight: `${height - 30}px`,
                overflow: "hidden",
              }}
            >
              {book.title}
            </p>
            {book.author && (
              <p
                className="font-sans mt-1 opacity-70 truncate"
                style={{ fontSize: "7px" }}
              >
                {book.author.split(",")[0]}
              </p>
            )}
          </div>
        </div>

        {/* Top edge */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] rounded-t-sm"
          style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
        />

        {/* Bottom edge */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{ backgroundColor: "rgba(0,0,0,0.2)" }}
        />
      </div>
    </Link>
  );
}
