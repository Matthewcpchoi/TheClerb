"use client";

import Link from "next/link";
import { Book } from "@/types";
import BookCover from "./BookCover";
import { Button, Card, EmptyState, ScoreBadge, SectionTitle, StatusPill } from "./ui";
import { getExactPageCount } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface BookShelfProps {
  currentBook: Book | null;
  upcomingBooks: Book[];
  completedBooks: Book[];
  hallOfFame: (Book & { avgRating: number }) | null;
  hallOfShame: (Book & { avgRating: number }) | null;
  bookRatings: Record<string, number>;
  canEdit: boolean;
  onStartReading: (bookId: string) => void;
  onMarkFinished: (bookId: string) => void;
  onAddBook: () => void;
}

/** A cover with its score badge and title. The unit the whole shelf is built from. */
export function BookTile({
  book,
  score,
  className,
  muted,
}: {
  book: Book;
  score?: number;
  className?: string;
  muted?: boolean;
}) {
  return (
    <Link href={`/book/${book.id}`} className={cn("group block", className)}>
      <div className="relative">
        <BookCover
          book={book}
          className="w-full aspect-[2/3] rounded-lg shadow-[0_2px_4px_rgba(43,38,34,0.12),0_12px_24px_-10px_rgba(43,38,34,0.35)] transition-transform duration-200 group-hover:-translate-y-1"
          style={muted ? { filter: "saturate(0.55) brightness(0.9)" } : undefined}
        />
        {typeof score === "number" && (
          <ScoreBadge score={score} size="md" className="absolute -bottom-2.5 -right-2.5" muted={muted} />
        )}
      </div>
      <p className="font-serif text-[13px] text-charcoal mt-3.5 leading-snug line-clamp-2">
        {book.title}
      </p>
      {book.author && (
        <p className="font-sans text-[11px] text-warm-brown/80 mt-0.5 truncate">
          {book.author.split(",")[0]}
        </p>
      )}
    </Link>
  );
}

function CurrentlyReading({
  book,
  score,
  canEdit,
  onMarkFinished,
  onAddBook,
}: {
  book: Book | null;
  score?: number;
  canEdit: boolean;
  onMarkFinished: (id: string) => void;
  onAddBook: () => void;
}) {
  if (!book) {
    return (
      <Card>
        <EmptyState
          title="Nothing on the nightstand"
          body="Pick a book from Up Next to start reading, or add a new one."
          action={canEdit ? <Button onClick={onAddBook}>Add a book</Button> : undefined}
        />
      </Card>
    );
  }

  const pages = getExactPageCount(book);

  return (
    <Card className="overflow-hidden" padded={false}>
      <div className="flex gap-5 sm:gap-8 p-5 sm:p-7">
        <Link href={`/book/${book.id}`} className="flex-shrink-0 relative">
          <BookCover
            book={book}
            className="w-28 sm:w-40 aspect-[2/3] rounded-lg shadow-[0_4px_8px_rgba(43,38,34,0.15),0_20px_40px_-16px_rgba(43,38,34,0.45)]"
            eager
          />
          {typeof score === "number" && (
            <ScoreBadge score={score} size="lg" className="absolute -bottom-3 -right-3" />
          )}
        </Link>

        <div className="min-w-0 flex-1 flex flex-col">
          <StatusPill status="reading" />
          <Link href={`/book/${book.id}`} className="block mt-3">
            <h2 className="font-serif text-2xl sm:text-3xl text-charcoal leading-tight tracking-tight">
              {book.title}
            </h2>
          </Link>
          {book.author && (
            <p className="font-sans text-sm sm:text-base text-warm-brown mt-1.5">{book.author}</p>
          )}
          {pages && (
            <p className="font-sans text-xs text-warm-brown/60 mt-1">{pages.toLocaleString()} pages</p>
          )}

          <div className="mt-auto pt-5 flex flex-wrap gap-2">
            <Link
              href={`/book/${book.id}`}
              className="inline-flex items-center h-10 px-4 rounded-xl bg-mahogany text-cream font-sans text-sm font-medium hover:bg-espresso transition-colors"
            >
              Rate &amp; discuss
            </Link>
            {canEdit && (
              <Button variant="secondary" onClick={() => onMarkFinished(book.id)}>
                Mark finished
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Highlight({
  label,
  book,
  tone,
}: {
  label: string;
  book: (Book & { avgRating: number }) | null;
  tone: "fame" | "shame";
}) {
  return (
    <Card className="flex-1 min-w-0">
      <p
        className={cn(
          "font-sans text-[11px] font-semibold uppercase tracking-[0.18em] mb-4",
          tone === "fame" ? "text-gold" : "text-warm-brown/70"
        )}
      >
        {label}
      </p>
      {book ? (
        <Link href={`/book/${book.id}`} className="flex items-center gap-4 group">
          <div className="relative flex-shrink-0">
            <BookCover
              book={book}
              className="w-16 aspect-[2/3] rounded-md shadow-md transition-transform group-hover:-translate-y-0.5"
              style={tone === "shame" ? { filter: "saturate(0.55) brightness(0.9)" } : undefined}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-base text-charcoal leading-snug line-clamp-2">{book.title}</p>
            {book.author && (
              <p className="font-sans text-xs text-warm-brown mt-0.5 truncate">{book.author}</p>
            )}
          </div>
          <ScoreBadge score={book.avgRating} size="lg" muted={tone === "shame"} />
        </Link>
      ) : (
        <p className="font-sans text-sm text-warm-brown/60">No ratings yet.</p>
      )}
    </Card>
  );
}

export default function BookShelf({
  currentBook,
  upcomingBooks,
  completedBooks,
  hallOfFame,
  hallOfShame,
  bookRatings,
  canEdit,
  onStartReading,
  onMarkFinished,
  onAddBook,
}: BookShelfProps) {
  return (
    <div className="space-y-12">
      <section>
        <SectionTitle>Currently reading</SectionTitle>
        <CurrentlyReading
          book={currentBook}
          score={currentBook ? bookRatings[currentBook.id] : undefined}
          canEdit={canEdit}
          onMarkFinished={onMarkFinished}
          onAddBook={onAddBook}
        />
      </section>

      {upcomingBooks.length > 0 && (
        <section>
          <SectionTitle
            action={
              canEdit ? (
                <Button size="sm" variant="ghost" onClick={onAddBook}>
                  + Add
                </Button>
              ) : undefined
            }
          >
            Up next
          </SectionTitle>
          <div className="shelf-ledge">
            <div className="flex gap-4 sm:gap-5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
              {upcomingBooks.map((book) => (
                <div key={book.id} className="w-24 sm:w-28 flex-shrink-0">
                  <BookTile book={book} />
                  {canEdit && (
                    <button
                      onClick={() => onStartReading(book.id)}
                      className="mt-2 w-full h-8 rounded-lg bg-gold/15 text-[#8a6a22] font-sans text-xs font-medium hover:bg-gold/25 transition-colors"
                    >
                      Start reading
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="pt-2">
        <SectionTitle>
          Past reads{completedBooks.length > 0 && (
            <span className="text-warm-brown/50 font-normal normal-case tracking-normal ml-2">
              {completedBooks.length}
            </span>
          )}
        </SectionTitle>
        {completedBooks.length === 0 ? (
          <Card>
            <EmptyState
              title="No finished books yet"
              body="When you mark a book finished it lands here, ranked by the club's score."
            />
          </Card>
        ) : (
          <div className="shelf-ledge">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-4 gap-y-8 sm:gap-x-6">
              {completedBooks.map((book) => (
                <BookTile key={book.id} book={book} score={bookRatings[book.id]} />
              ))}
            </div>
          </div>
        )}
      </section>

      {(hallOfFame || hallOfShame) && (
        <section className="pt-2">
          <SectionTitle>Club favourites</SectionTitle>
          <div className="flex flex-col sm:flex-row gap-4">
            <Highlight label="Hall of fame" book={hallOfFame} tone="fame" />
            <Highlight label="Hall of shame" book={hallOfShame} tone="shame" />
          </div>
        </section>
      )}
    </div>
  );
}
