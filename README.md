# The Clerb — Book Club App

A warm, intimate book club web app built with Next.js, Supabase, and Tailwind CSS. Designed to feel like walking into a beautifully curated independent bookstore.

## Features

- **The Shelf** — A realistic wooden bookcase displaying books as 3D spines, with a featured "Currently Reading" display, Hall of Fame, and Hall of Shame
- **Book Detail** — Rate books pre- and post-discussion with a granular 0.00-10.00 slider. Ratings are private until you choose to reveal them
- **Discussion Topics** — Add discussion questions that are hidden/blurred by default to prevent spoilers
- **Calendar** — Schedule meetings, RSVP with one tap, and see who's attending in real-time
- **Members** — Simple name-based identity with stats tracking (no passwords needed)
- **Real-time** — Supabase real-time subscriptions keep ratings and RSVPs in sync across all clients

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Supabase** (Postgres, real-time subscriptions)
- **Tailwind CSS** (warm bookstore design system)
- **Google Books API** (book search and cover images)

## Setup

### 1. Create a Supabase Project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Run the Database Schema

In the Supabase SQL Editor, run the following:

```sql
-- Members of the club
CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Books the club has read or is reading
CREATE TABLE books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text,
  cover_url text,
  thumbnail_url text,
  spine_color text,
  google_books_id text,
  total_pages integer,
  status text CHECK (status IN ('reading', 'completed', 'upcoming')) DEFAULT 'upcoming',
  added_by uuid REFERENCES members(id),
  created_at timestamptz DEFAULT now()
);

-- Individual ratings per member per book
CREATE TABLE ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES books(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  pre_rating numeric(4,2) CHECK (pre_rating >= 0 AND pre_rating <= 10),
  post_rating numeric(4,2) CHECK (post_rating >= 0 AND post_rating <= 10),
  rating_change_reason text,
  is_visible boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(book_id, member_id)
);

-- Discussion questions/topics per book
CREATE TABLE discussion_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES books(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id),
  content text NOT NULL,
  is_spoiler boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Club meeting events
CREATE TABLE meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES books(id),
  title text NOT NULL,
  date date NOT NULL,
  time time NOT NULL,
  location text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Attendance RSVP per meeting
CREATE TABLE attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  status text CHECK (status IN ('going', 'maybe', 'not_going')) DEFAULT 'going',
  UNIQUE(meeting_id, member_id)
);

-- Enable Row Level Security (allow all for trusted app)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on members" ON members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on books" ON books FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ratings" ON ratings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on discussion_topics" ON discussion_topics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on meetings" ON meetings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);
```

### 3. Enable Realtime

In Supabase Dashboard, go to **Database > Replication** and enable realtime for the `ratings` and `attendance` tables.

### 4. Set Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Install and Run

```bash
npm install
npm run dev
```

### 6. Deploy to Vercel

1. Push this repo to GitHub
2. Connect the repo to [Vercel](https://vercel.com)
3. Add the two environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
4. Deploy

## Design

The app uses a "Warm Bookstore" design language:
- Cream backgrounds, mahogany/espresso browns, muted gold accents, sage green
- Playfair Display serif for headings, Source Sans 3 for body text
- Realistic 3D book spines with CSS effects
- Wooden bookshelf with multi-tier layout
- Subtle paper textures and warm shadows

## Additional Documentation

- [Contributing Guide](./CONTRIBUTING.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Database Notes](./DATABASE.md)
- [Project Memory](./docs/PROJECT_MEMORY.md)
