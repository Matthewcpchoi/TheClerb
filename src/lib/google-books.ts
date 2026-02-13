import { GoogleBooksResult } from "@/types";

export async function searchBooks(query: string): Promise<GoogleBooksResult[]> {
  if (!query.trim()) return [];

  const encodedQuery = encodeURIComponent(query);
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=8&key=${process.env.NEXT_PUBLIC_GOOGLE_BOOKS_KEY}`
  );

  if (!res.ok) return [];

  const data = await res.json();
  return data.items || [];
}

export function getBookCoverUrl(result: GoogleBooksResult): string | null {
  const links = result.volumeInfo.imageLinks;
  if (!links) return null;
  // Use thumbnail and upgrade to higher res by replacing zoom parameter
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
