import { NextRequest } from "next/server";
import { resolveCoverCandidates } from "@/lib/cover-sources";

export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 5000;

/**
 * Providers return their "no cover available" placeholder with HTTP 200, so a
 * status check is not enough — the bytes have to be inspected.
 *
 * Real cover art is JPEG, PNG or WebP. Both Google's grey placeholder and
 * Open Library's blank are GIFs, so the format alone rejects most of them;
 * size and decoded dimensions catch the rest.
 */
const MIN_BYTES = 1500;
const MIN_DIMENSION = 50;

function readImageSize(
  buf: Uint8Array
): { width: number; height: number } | null {
  // PNG: IHDR width/height at byte 16.
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }

  // GIF: little-endian width/height at byte 6.
  if (buf.length > 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return {
      width: buf[6] | (buf[7] << 8),
      height: buf[8] | (buf[9] << 8),
    };
  }

  // JPEG: walk segments to the first SOF marker.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 && // DHT
        marker !== 0xc8 && // JPG
        marker !== 0xcc; // DAC
      if (isSof) {
        return {
          height: (buf[i + 5] << 8) | buf[i + 6],
          width: (buf[i + 7] << 8) | buf[i + 8],
        };
      }
      const len = (buf[i + 2] << 8) | buf[i + 3];
      if (len <= 0) break;
      i += 2 + len;
    }
  }

  return null; // unknown format — do not reject on this signal alone
}

function isUsableCover(contentType: string, bytes: Uint8Array): boolean {
  if (bytes.length < MIN_BYTES) return false;
  if (contentType.includes("gif")) return false;
  if (!contentType.startsWith("image/")) return false;

  const size = readImageSize(bytes);
  if (size && (size.width < MIN_DIMENSION || size.height < MIN_DIMENSION)) {
    return false;
  }
  return true;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const candidates = await resolveCoverCandidates({
    googleBooksId: params.get("gid"),
    isbn: params.get("isbn"),
    title: params.get("title"),
    author: params.get("author"),
  });

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          // Some providers vary their response by user agent.
          "User-Agent": "TheClerb/1.0 (book club app)",
          Accept: "image/avif,image/webp,image/jpeg,image/png,*/*",
        },
      });
      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") || "";
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!isUsableCover(contentType, bytes)) continue;

      return new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          // Covers never change; let the CDN keep them.
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      continue; // timeout or network error — try the next provider
    }
  }

  // Nothing usable. Short cache so a later add of an ISBN can be picked up,
  // and the client renders its own typographic fallback.
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
