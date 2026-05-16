# Pantry Paper

Pantry Paper is a mobile-first grocery list PWA built with Next.js, Supabase, and Vercel. It supports:

- Magic-link and Google sign-in through Supabase Auth
- Unlimited personal and shared grocery lists
- Share-by-link collaboration for signed-in users
- Realtime multi-device sync with Supabase Realtime
- Archive-based product suggestions
- Optimistic updates with a local offline mutation queue
- English and Hebrew UI with LTR and RTL support

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS v4
- Supabase Auth, Postgres, Realtime, and RLS
- TanStack Query with IndexedDB cache persistence
- Vercel for hosting

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the env template:

```bash
cp .env.example .env.local
```

3. Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

4. Create a Supabase project and enable:

- Email OTP / magic link auth
- Google auth provider
- Realtime

5. Run the SQL migration in the Supabase SQL editor:

File: [supabase/migrations/202605162200_init.sql](/Users/zeevkatz/proj/meow/supabase/migrations/202605162200_init.sql)

6. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase Notes

- The app uses cookie-based auth via `@supabase/ssr`.
- Shared list membership is handled by the `join_list_by_slug` RPC.
- Item writes go through RPC functions so optimistic updates, offline replay, and realtime reconciliation all share the same mutation contract.
- RLS allows members to read and edit only the lists they belong to.

## Quality Checks

```bash
npm run lint
npm run build
```

The build script uses `webpack` mode because Turbopack panicked in the local sandbox during verification.

## Deploying To Vercel

1. Push the repository to GitHub.
2. Import the project into Vercel.
3. Add the same three environment variables from `.env.local`.
4. Make sure the Supabase auth redirect URLs include:

- `http://localhost:3000/auth/callback`
- `https://your-production-domain.com/auth/callback`

5. Deploy.

## Key Files

- App shell: [src/app/layout.tsx](/Users/zeevkatz/proj/meow/src/app/layout.tsx)
- Dashboard route: [src/app/page.tsx](/Users/zeevkatz/proj/meow/src/app/page.tsx)
- Shared list route: [src/app/lists/[shareSlug]/page.tsx](/Users/zeevkatz/proj/meow/src/app/lists/[shareSlug]/page.tsx)
- List client logic: [src/components/lists/list-client.tsx](/Users/zeevkatz/proj/meow/src/components/lists/list-client.tsx)
- Supabase helpers: [src/lib/supabase](/Users/zeevkatz/proj/meow/src/lib/supabase)
