# Contributing to The Clerb

Thanks for helping improve The Clerb.

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment variables:
   ```bash
   cp .env.local.example .env.local
   ```
3. Fill `.env.local` with your Supabase project values.
4. Start the app:
   ```bash
   npm run dev
   ```

## Workflow

- Create a feature branch from `main`.
- Keep changes focused and small.
- Run lint before opening a PR:
  ```bash
  npm run lint
  ```
- Include clear PR notes describing what changed and why.

## Code conventions

- TypeScript-first (prefer explicit types at API boundaries).
- Keep React components composable and focused.
- Reuse utilities in `src/lib` and shared types in `src/types`.
- Keep the warm "bookstore" visual style intact when making UI changes.

## Supabase changes

If your change requires database updates:

- Document SQL changes in the PR.
- Keep table/column naming consistent with existing schema.
- Note any required realtime replication updates.

## Testing checklist

Before submitting:

- [ ] `npm run lint` passes.
- [ ] Core routes load (`/`, `/shelf`, `/calendar`, `/members`).
- [ ] Any changed feature is manually smoke-tested.
