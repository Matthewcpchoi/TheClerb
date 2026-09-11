# The Clerb

A book club coordination web app.

## Stack
- TypeScript, React 18, Next.js 14
- Tailwind CSS 3.4 (custom warm palette: cream, mahogany, espresso, gold, sage)
- Supabase (client-side, real-time subscriptions)
- Google Books API (search, covers, page counts)
- Fonts: Playfair Display (serif), Source Sans 3 (sans)

## Core Entities (Supabase tables)
- **members** — id, name, created_at
- **books** — id, title, author, cover_url, thumbnail_url, isbn, spine_color, google_books_id, status (reading|completed|upcoming), added_by, page_count, completed_at, created_at
- **ratings** — id, book_id, member_id, pre_rating, post_rating, rating_change_reason, is_visible, created_at, updated_at
- **book_comments** — id, book_id, member_id, content, created_at, updated_at — UNIQUE(book_id, member_id); one "take" per member per book
- **discussion_topics** — id, book_id, member_id, content, is_spoiler, created_at
- **meetings** — id, book_id, title, date, time, location, notes, created_at
- **attendance** — id, meeting_id, member_id, status (going|maybe|not_going)

Migrations live in `supabase/migrations/` and are idempotent; run them in the Supabase SQL editor.

## File Structure
```
src/
├── app/
│   ├── page.tsx              # Home: currently reading hero, next meeting, stats
│   ├── layout.tsx            # Root layout (server), metadata, fonts
│   ├── globals.css           # Tailwind, slider, score glow, shelf-ledge, spoiler blur
│   ├── shelf/page.tsx        # The Shelf: current read, up next, past reads grid, fame/shame
│   ├── book/[id]/page.tsx    # Book detail: single rating + "Change rating", your take, club, topics
│   ├── calendar/page.tsx     # Meetings: create/edit/delete, optimistic RSVP, book selection
│   ├── members/page.tsx      # Members with stats; tap a book tile to drop down score + take
│   ├── admin/covers/page.tsx # Cover repair: re-resolve all covers, or pick one by hand
│   └── api/cover/route.ts    # Server-side cover resolution + validation (?resolve=1, ?debug=1)
├── components/
│   ├── ui.tsx                # Design primitives: Button, Card, PageHeader, SectionTitle,
│   │                         #   Avatar, ScoreBadge (+ scoreTone), StatusPill, EmptyState
│   ├── Navigation.tsx        # Desktop top nav + mobile bottom nav
│   ├── ClientLayout.tsx      # MemberProvider + Header + Navigation wrapper
│   ├── MemberProvider.tsx    # React Context for current member (localStorage)
│   ├── WelcomeModal.tsx      # First-visit member selection
│   ├── MemberSelector.tsx    # Header dropdown to switch members
│   ├── BookCover.tsx         # The only way covers are rendered; cascades stored URLs, fallback card
│   ├── BookShelf.tsx         # Shelf layout + BookTile (cover + ScoreBadge + title)
│   ├── BookSearch.tsx        # Add-book modal: Google search, resolves cover at add time
│   ├── RatingSlider.tsx      # 0-10 slider; optional "what changed?" note
│   ├── ClubRatings.tsx       # Club score, distribution, expandable per-member rows (comment, revision)
│   ├── DiscussionTopics.tsx  # Spoiler-blur questions for the meeting
│   ├── MeetingCard.tsx       # Meeting display: date block, cover, edit/delete, attendance
│   └── AttendanceTracker.tsx # Segmented RSVP control + who's going
├── lib/
│   ├── supabase.ts           # Supabase client init
│   ├── books.ts              # markCompleted() — sets status + completed_at
│   ├── covers.ts             # Render candidates (stored URLs only), proxyCoverUrl, resolveCoverUrl
│   ├── cover-sources.ts      # Server: work-level resolution across Open Library, Apple, Google
│   ├── google-books.ts       # searchBooks(), fetchVolumeById(), getISBN()
│   ├── open-library.ts       # fetchOpenLibraryByISBN() (page counts)
│   ├── color-extract.ts      # getDeterministicSpineColor() — hash of title, no network
│   └── utils.ts              # getInitials, getAvatarColor, formatDate, formatTime, cn, getExactPageCount
└── types/index.ts            # TypeScript interfaces for all entities

## Environment Variables
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY (optional, for higher rate limits)

## Key Patterns
- No auth — member context via localStorage + MemberProvider
- All data via client-side Supabase; the one API route is `/api/cover` (server-side image resolution)
- Real-time: Supabase channels for ratings, book_comments and attendance
- Covers are resolved ONCE, at add time (`resolveCoverUrl` → `/api/cover?resolve=1`), and the winning
  URL is stored on the row. Rendering (`BookCover`) only ever uses stored URLs, so a cover never
  changes between visits. Resolution is work-level, not edition-level: ISBN → work → the work's own
  cover, then verified title/author searches, then Google volume art last. `/admin/covers` re-resolves
  or lets a person pick.
- Rating flow: one rating. First save → pre_rating. "Change rating" → same slider prefilled, optional
  note, "Keep my rating" to cancel. A changed value is stored as post_rating so the original is kept and
  shown as "went in at / left at". Ratings are private until the member reveals them.
- Scores everywhere use `ScoreBadge`/`scoreTone`: <5 bad (red), 5–6.9 okay (amber), 7–9.9 good (sage),
  10 perfect (gold, glows).
- UI: use primitives from `components/ui.tsx`; Playfair Display for titles, Source Sans for body; no
  script fonts, no skeuomorphic textures.
```
