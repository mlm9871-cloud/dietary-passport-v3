# Dining Passport

Project scaffold for Dining Passport — a dietary profile platform for college students.

Setup (local):

1. Install dependencies

```bash
npm install
```

2. Add environment variables (example `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. Apply the SQL schema to your Supabase project (use `sql/schema.sql`).

4. Run dev server

```bash
npm run dev
```

Files added:
- `app/` — Next.js App Router scaffold
- `components/` — reusable UI components (empty placeholder)
- `lib/supabaseClient.ts` — Supabase client wrapper
- `types/` — TypeScript types
- `sql/schema.sql` — Supabase schema

Next steps: I'll wait for your confirmation of the foundation before building screens one at a time.

