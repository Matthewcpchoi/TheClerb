# The Clerb

A book club coordination web app.

## Stack
- TypeScript, React 18, Next.js 14
- Tailwind CSS 3.4 — palette is the design's five colours ONLY:
  ground `#fff5e7`, tan `#e6d2b6`, tan-soft `#f0e0c6`, teal `#2dbba1`,
  green `#009774`, ink `#0e5f49`, muted `#3d6a58`
- Supabase (client-side, real-time subscriptions)
- Google Books / Open Library / Apple Books (search, covers, page counts)
- Fonts: Inter for all UI; ui-monospace/Menlo for EVERY number (`.num`)
- Phosphor icons (`@phosphor-icons/react`), regular → fill when a tab is active

Built from the `4a` design handoff (four tabs: Reading, Shelf, Meet, Club).
Design width 402pt; the app caps at 448px and centres on wider screens.

## Core Entities (Supabase tables)
- **members** — id, name, created_at
- **books** — id, title, author, cover_url, thumbnail_url, isbn, spine_color, google_books_id, status (reading|completed|upcoming), added_by, page_count, completed_at, created_at
- **ratings** — id, book_id, member_id, pre_rating, post_rating, rating_change_reason, is_visible, created_at, updated_at
- **book_comments** — id, book_id, member_id, content, created_at, updated_at — UNIQUE(book_id, member_id); one "take" per member per book
- **book_progress** — id, book_id, member_id, status (none|reading|finished|dnf), updated_at — UNIQUE(book_id, member_id); where each member is with a book
- **discussion_topics** — id, book_id, member_id, content, is_spoiler, created_at
- **meetings** — id, book_id, title, date, time, location, notes, created_at
- **attendance** — id, meeting_id, member_id, status (going|maybe|not_going)

Migrations live in `supabase/migrations/` and are idempotent; run them in the Supabase SQL editor.

## File Structure
```
src/
├── app/
│   ├── page.tsx              # READING tab: full-bleed cover, the ledger, next meeting
│   ├── layout.tsx            # Root layout, Inter, viewport
│   ├── globals.css           # Palette vars, .num, .kicker, .rule, .score-blur, .spine-title
│   ├── shelf/page.tsx        # SHELF tab: spine row, tipped-out cover, sort, members table
│   ├── calendar/page.tsx     # MEET tab: next up, RSVP, penciled in
│   ├── members/page.tsx      # CLUB tab: your profile, stats, your highest, switch member
│   ├── book/[id]/page.tsx    # Book: score ticks, your take, everyone's scores, discussion
│   ├── admin/covers/page.tsx # Cover repair (not in the design; utility)
│   └── api/cover/route.ts    # Server-side cover resolution (?resolve=1, ?debug=1)
├── components/
│   ├── ui.tsx                # Kicker, Rule, Num, PillButton, OutlineButton, SolidButton,
│   │                         #   Initials, ScreenTitle
│   ├── TabBar.tsx            # The four tabs, 78px, blurred, Phosphor regular→fill
│   ├── ClientLayout.tsx      # MemberProvider + 448px centred column + TabBar
│   ├── MemberProvider.tsx    # Current member (localStorage, revalidated) + members list
│   ├── WelcomeModal.tsx      # First-visit member pick (gap-fill, not designed)
│   ├── BookCover.tsx         # The only way covers render; cascades stored URLs
│   ├── BookSearch.tsx        # Add-book sheet (gap-fill, not designed)
│   ├── ScoreTicks.tsx        # 21 ticks, 0–10 in half steps — from the design's book screen
│   └── DiscussionTopics.tsx  # Blurred questions, tap to unblur
├── lib/
│   ├── supabase.ts           # Supabase client init
│   ├── design.ts             # spineColor/Width/Height from a title hash; shortMonthYear
│   ├── books.ts              # markCompleted(); healUnresolvedCovers()
│   ├── covers.ts             # Render candidates (stored URLs only), resolveCoverUrl
│   ├── cover-sources.ts      # Server: work-level resolution (Open Library, Apple, Google)
│   ├── google-books.ts       # searchBooks(), fetchVolumeById(), getISBN()
│   ├── open-library.ts       # fetchOpenLibraryByISBN() (page counts)
│   └── utils.ts              # cn, getExactPageCount
└── types/index.ts            # TypeScript interfaces for all entities
```

## Environment Variables
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_GOOGLE_BOOKS_KEY (optional, for higher rate limits)

## Key Patterns
- No auth — member context via localStorage + MemberProvider (revalidated against the DB).
- All data via client-side Supabase; the one API route is `/api/cover`.
- **Progress is status, never page numbers.** `book_progress` holds none|reading|finished|dnf.
  A page count appears once, beside the author, as book metadata. No page counters anywhere.
- **Scores are 0–10 in half-point steps**, entered with `ScoreTicks`.
- **Blur, not secrecy.** Other members' scores render blurred (`filter: blur(6px)`,
  `transition: filter .45s ease`) until someone taps Reveal. Reveal is per-book and local
  (`localStorage['reveal-<bookId>']`). Your own score is never blurred. Scores are fetched
  eagerly — the blur is presentational, matching the design. `ratings.is_visible` is retained
  on the row but no longer gates the ledger; gate server-side if the club ever wants real secrecy.
- Ledger order: finished (by score desc), then reading, then not started, then DNF. Status mark is
  2px: green if scored, teal if reading, transparent otherwise. DNF names strike through.
- Tapping your own name in the ledger cycles your status; other rows are not tappable.
- Covers are resolved ONCE at add time (`resolveCoverUrl` → `/api/cover?resolve=1`) and stored.
  Rendering uses only stored URLs, so a cover never changes between visits. Resolution is
  work-level, not edition-level: ISBN → work → the work's own cover, then verified title/author
  searches, then Google volume art last.
- Spine colour/width/height derive from a hash of the title (`lib/design.ts`) so a book looks the
  same everywhere. Colours come from the palette only.
- **Every number is monospace** — wrap it in `<Num>` or `.num`.
- Section dividers use `.rule` (fades at both ends); row separators use `.row-line`.

## Not designed (see the handoff README's Gaps)
Empty/loading/error states, onboarding, nominations and voting for the next book, landscape,
dynamic type, dark mode. Gap-fills built here (add-book sheet, welcome modal, member switching,
meeting creation) stay inside the palette and type scale.
