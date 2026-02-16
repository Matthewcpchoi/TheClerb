interface OpenLibraryEdition {
  number_of_pages?: number;
  covers?: number[];
  title?: string;
}

export async function fetchOpenLibraryByISBN(
  isbn: string
): Promise<OpenLibraryEdition | null> {
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function getOpenLibraryCoverByISBN(
  isbn: string,
  size: "S" | "M" | "L" = "L"
): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg`;
}

export function getOpenLibraryCoverById(
  coverId: number,
  size: "S" | "M" | "L" = "L"
): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}
