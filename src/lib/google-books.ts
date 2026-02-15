import { GoogleBooksResult } from "@/types";

export async function searchBooks(query: string): Promise<GoogleBooksResult[]> {
  if (!query.trim()) return [];

  const encodedQuery = encodeURIComponent(query.trim());
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=10&printType=books`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    // If direct call fails, try with no-cors workaround or return empty
    return [];
  }
}

export function getBookCoverUrl(result: GoogleBooksResult): string | null {
  const links = result.volumeInfo.imageLinks;
  if (!links) return null;
  const url = links.thumbnail || links.smallThumbnail || null;
  if (url) {
    return url.replace("http://", "https://").replace("zoom=1", "zoom=2");
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
