# Database Notes

This project uses Supabase Postgres with row-level security enabled and permissive policies suitable for a trusted private club app.

## Core tables

- `members`
- `books`
- `ratings`
- `discussion_topics`
- `meetings`
- `attendance`

For the canonical SQL schema, use the setup block in `README.md`.

## Realtime requirements

Enable replication for:

- `ratings`
- `attendance`

This is required for live updates across clients.

## Environment variables

Add to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Operational guidance

- Keep `status` enum-like values consistent (`reading`, `completed`, `upcoming`).
- Preserve uniqueness constraints:
  - `members.name`
  - `ratings(book_id, member_id)`
  - `attendance(meeting_id, member_id)`
- When adding schema changes, also update developer docs and migration notes in PR descriptions.
