import { NextRequest } from "next/server";
import {
  directCoverCandidates,
  searchCoverCandidates,
  type CoverQuery,
} from "@/lib/cover-sources";

export const runtime = "nodejs";
export const maxDuration = 20;

/**
 * Serverless functions are killed at a hard platform limit (10s on Vercel's
 * Hobby tier). Everything here is bounded so the route always answers well
 * inside that: a timed-out function returns a 504 and every cover on the page
 * fails at once, which is far worse than falling back for a single book.
 */
const TOTAL_BUDGET_MS = 7000;
const IMAGE_TIMEOUT_MS = 2500;
const MAX_CANDIDATES = 8;

/**
 * Providers return their "no cover available" placeholder with HTTP 200, so a
 * status check is not enough — the bytes have to be inspected.
 *
 * Real cover art is JPEG, PNG or WebP. Both Google's grey placeholder and
 * Open Library's blank are GIFs, so format alone rejects most of them; size
 * and decoded dimensions catch the rest.
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
    return { width: buf[6] | (buf[7] << 8), height: buf[8] | (buf[9] << 8) };
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

/**
 * Google's "image not available" placeholder is returned with HTTP 200 and a
 * plausible cover-shaped size, so it has to be rejected on content. It is a
 * flat two-tone graphic, which compresses far smaller than any real cover
 * scan at the same dimensions.
 */
const GOOGLE_PLACEHOLDER_MAX_BYTES = 4500;

function rejectionReason(
  url: string,
  contentType: string,
  bytes: Uint8Array
): string | null {
  if (bytes.length < MIN_BYTES) return `too small (${bytes.length}B)`;
  if (contentType.includes("gif")) return "gif (provider placeholder)";
  if (!contentType.startsWith("image/")) return `not an image (${contentType})`;

  const size = readImageSize(bytes);
  if (size && (size.width < MIN_DIMENSION || size.height < MIN_DIMENSION)) {
    return `too small (${size.width}x${size.height})`;
  }

  if (
    url.includes("books.google.com") &&
    bytes.length < GOOGLE_PLACEHOLDER_MAX_BYTES
  ) {
    return `likely "image not available" placeholder (${bytes.length}B)`;
  }

  return null;
}

interface Attempt {
  url: string;
  result: string;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const debug = params.get("debug") === "1";
  const startedAt = Date.now();
  const attempts: Attempt[] = [];

  const query: CoverQuery = {
    googleBooksId: params.get("gid"),
    isbn: params.get("isbn"),
    title: params.get("title"),
    author: params.get("author"),
  };

  const timeLeft = () => TOTAL_BUDGET_MS - (Date.now() - startedAt);

  async function tryCandidates(urls: string[]): Promise<Response | null> {
    for (const url of urls.slice(0, MAX_CANDIDATES)) {
      if (timeLeft() <= 500) {
        attempts.push({ url, result: "skipped (out of time budget)" });
        break;
      }

      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(Math.min(IMAGE_TIMEOUT_MS, timeLeft())),
          headers: {
            "User-Agent": "TheClerb/1.0 (book club app)",
            Accept: "image/avif,image/webp,image/jpeg,image/png,*/*",
          },
        });

        if (!res.ok) {
          attempts.push({ url, result: `HTTP ${res.status}` });
          continue;
        }

        const contentType = res.headers.get("content-type") || "";
        const bytes = new Uint8Array(await res.arrayBuffer());
        const reason = rejectionReason(url, contentType, bytes);

        if (reason) {
          attempts.push({ url, result: `rejected: ${reason}` });
          continue;
        }

        attempts.push({ url, result: `OK (${bytes.length}B ${contentType})` });
        if (debug) return null; // keep going so debug lists every attempt

        return new Response(bytes, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            // Covers never change; let the CDN hold them.
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.name : "error";
        attempts.push({ url, result: `failed: ${msg}` });
      }
    }
    return null;
  }

  // Phase 1: exact identifier lookups. No search round trip, so books with an
  // ISBN or volume id answer fast and never reach the slower phase.
  let hit = await tryCandidates(directCoverCandidates(query));

  // Phase 2: title/author searches, only if phase 1 found nothing.
  let searched: string[] = [];
  if (!hit && timeLeft() > 1500) {
    searched = await searchCoverCandidates(query);
    hit = await tryCandidates(searched);
  }

  if (debug) {
    return Response.json(
      {
        query,
        elapsedMs: Date.now() - startedAt,
        budgetMs: TOTAL_BUDGET_MS,
        directCandidates: directCoverCandidates(query),
        searchCandidates: searched,
        attempts,
        verdict: attempts.some((a) => a.result.startsWith("OK"))
          ? "at least one provider returned a usable cover"
          : "no provider returned a usable cover",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (hit) return hit;

  // Nothing usable. Short cache so a later ISBN backfill can be picked up;
  // the client renders its own typographic fallback.
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
