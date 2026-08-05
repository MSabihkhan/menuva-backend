# Menuva Backend

Node.js + Express + TypeScript backend for Menuva, using `@supabase/supabase-js` only (no ORM).

## Quick Start

```bash
cp .env.example .env
# Fill in your Supabase credentials and other required vars
npm install
npm run dev
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm run typecheck` | Type-check without emitting |

## Architecture

- **Stack:** Express 4 (MVC), `@supabase/supabase-js`, Zod, Pino
- **Auth:** Supabase Auth (staff) + minted table-session JWT (diner)
- **Money:** integer paisa; ratios in basis points
- **DB access:** RLS-enforced via request-scoped Supabase clients

See `Menuva-Backend-Specs/` for full specifications.
