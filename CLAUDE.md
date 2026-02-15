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
- **books** — id, title, author, cover_url, thumbnail_url, spine_color, google_books_id, description, status (reading|completed|upcoming), added_by, page_count?, completed_at?, created_at
- **ratings** — id, book_id, member_id, pre_rating, post_rating, rating_change_reason, is_visible, created_at, updated_at
- **discussion_topics** — id, book_id, member_id, content, is_spoiler, created_at
- **meetings** — id, book_id, title, date, time, location, notes, created_at
- **attendance** — id, meeting_id, member_id, status (going|maybe|not_going)

## File Structure
```
src/
├── app/
│   ├── page.tsx              # Home: hero, currently reading, next club, stats
│   ├── layout.tsx            # Root layout (server), metadata, fonts
│   ├── globals.css           # Tailwind + bookshelf CSS (wood-shelf, shelf-back, etc.)
│   ├── shelf/page.tsx        # Bookshelf page: BookShelf component + Up Next + Mark Complete
│   ├── book/[id]/page.tsx    # Book detail: ratings (pre/post flow), discussion topics
│   ├── calendar/page.tsx     # Meetings: create/edit/delete, RSVP, book selection
│   └── members/page.tsx      # Member list, join club
├── components/
│   ├── Navigation.tsx        # Desktop top nav + mobile bottom nav
│   ├── ClientLayout.tsx      # MemberProvider + Header + Navigation wrapper
│   ├── MemberProvider.tsx    # React Context for current member (localStorage)
│   ├── WelcomeModal.tsx      # First-visit member selection
│   ├── MemberSelector.tsx    # Header dropdown to switch members
│   ├── BookShelf.tsx         # Visual bookcase: currently reading, past reads (spines), hall of fame/shame
│   ├── BookSpine.tsx         # Single spine with 3D styling, color, hover lift
│   ├── BookSearch.tsx        # Modal: debounced Google Books search, add book
│   ├── RatingSlider.tsx      # 0-10 slider with submit button
│   ├── RatingReveal.tsx      # All ratings display: averages, dot plot, per-member
│   ├── DiscussionTopics.tsx  # Spoiler-blur topics with add form
│   ├── MeetingCard.tsx       # Meeting display: cover art, edit/delete, attendance
│   └── AttendanceTracker.tsx # RSVP buttons + attendance summary
├── lib/
│   ├── supabase.ts           # Supabase client init
│   ├── google-books.ts       # searchBooks(), getBookCoverUrl(), getThumbnailUrl()
│   ├── color-extract.ts      # Canvas color extraction for spine backgrounds
│   └── utils.ts              # getInitials, getAvatarColor, formatDate, formatTime, cn
└── types/index.ts            # TypeScript interfaces for all entities

## Environment Variables
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY (optional, for higher rate limits)

## Key Patterns
- No auth — member context via localStorage + MemberProvider
- All data via client-side Supabase (no API routes)
- Real-time: Supabase channels for ratings and attendance
- Book covers: use referrerPolicy="no-referrer" on all <img> tags (Google Books blocks Referer)
- Rating flow: pre-club score → "Change your score?" post-club (defaults to pre) → reason prompt if changed
```
