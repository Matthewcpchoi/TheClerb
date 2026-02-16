import { GoogleBooksResult } from "@/types";

function getGoogleBooksApiKey(): string {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_BOOKS_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY ||
    ""
  );
}

function withApiKey(url: string): string {
  const apiKey = getGoogleBooksApiKey();
  if (!apiKey) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}key=${encodeURIComponent(apiKey)}`;
}

export async function searchBooks(query: string): Promise<GoogleBooksResult[]> {
  if (!query.trim()) return [];

  const encodedQuery = encodeURIComponent(query.trim());
  const baseUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=10&printType=books`;
  const url = withApiKey(baseUrl);

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export async function fetchVolumeById(
  volumeId: string
): Promise<GoogleBooksResult | null> {
  const baseUrl = `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(volumeId)}`;
  const url = withApiKey(baseUrl);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Extract ISBN-13 (preferred) or ISBN-10 from a Google Books result.
 * The search endpoint uses a "lite" projection that often omits
 * industryIdentifiers — call fetchVolumeById for the full record.
 */
export function getISBN(result: GoogleBooksResult): string | null {
  const ids = result.volumeInfo.industryIdentifiers;
  if (!ids) return null;
  const isbn13 = ids.find((id) => id.type === "ISBN_13");
  if (isbn13) return isbn13.identifier;
  const isbn10 = ids.find((id) => id.type === "ISBN_10");
  if (isbn10) return isbn10.identifier;
  return null;
}

/**
 * Get the best available cover URL from a Google Books result.
 * Prefers higher resolution: extraLarge → large → medium → thumbnail (zoom=3) → smallThumbnail.
 */
export function getBookCoverUrl(result: GoogleBooksResult): string | null {
  const links = result.volumeInfo.imageLinks;
  if (!links) return null;

  // Try high-res variants first (only available from the volume detail endpoint)
  const highRes = links.extraLarge || links.large || links.medium;
  if (highRes) {
    return highRes.replace("http://", "https://");
  }

  // Fall back to thumbnail with zoom=3 for higher resolution
  const url = links.thumbnail || links.smallThumbnail || null;
  if (url) {
    return url.replace("http://", "https://").replace("zoom=1", "zoom=3");
  }
  return null;
}

export function getThumbnailUrl(result: GoogleBooksResult): string | null {
  const links = result.volumeInfo.imageLinks;
  if (!links) return null;
  return (links.smallThumbnail || links.thumbnail || "").replace(
    "http://",
    "https://"
  );
}
