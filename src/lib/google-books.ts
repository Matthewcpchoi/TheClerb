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

export async function fetchVolumeById(volumeId: string) {
  const baseUrl = `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(volumeId)}`;
  const url = withApiKey(baseUrl);
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

export function getBookCoverUrl(result: GoogleBooksResult): string | null {
  const links = result.volumeInfo.imageLinks;
  if (!links) return null;
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
