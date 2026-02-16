# The Clerb Architecture

This document describes how the application is organized.

## Stack

- Next.js 14 (App Router, TypeScript)
- Supabase for database + realtime
- Tailwind CSS for styling
- Google Books API for search metadata

## Source layout

- `src/app`: route files and layouts
- `src/components`: reusable UI + feature components
- `src/lib`: external integrations and utility logic
- `src/types`: shared TypeScript interfaces

## Data flow

1. UI components call Supabase client helpers from `src/lib/supabase.ts`.
2. Data is mapped into shared interfaces from `src/types`.
3. Feature components render and mutate records (books, ratings, topics, meetings, attendance).
4. Realtime subscriptions keep rating and attendance views up to date.

## Key domain entities

- **members**: club participants
- **books**: reading list with status (`reading`, `completed`, `upcoming`)
- **ratings**: per-member pre/post discussion ratings
- **discussion_topics**: spoiler-aware prompts and notes
- **meetings**: scheduled events linked to books
- **attendance**: RSVP state for each meeting/member

## UI design principles

- Warm bookstore aesthetic (cream, mahogany, gold, sage)
- Serif-forward typography for headings
- Soft depth/shadow and tactile surfaces
- Privacy-first interaction for unrevealed ratings/spoilers
