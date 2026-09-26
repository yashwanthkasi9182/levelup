# LevelUp

A mobile-first goal tracker with flexible targets, XP, and one accountability partner.

## Upgrade an existing deployment

**Apply any pending migrations in order: `002_flexible_goals.sql`, then `003_ten_goals.sql`, before deploying this version.** Do not rerun migration 001.

Read the [upgrade guide](docs/UPGRADE.md) for the optional account/data reset, migration order, Supabase SMTP and email templates, callback URLs, reward rules, and manual acceptance checklist. The migration and reset have not been run automatically.

## Local development

Requires Node.js 22 and npm.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. The server binds to `0.0.0.0` for phone access on the same network. Add the computer's LAN origin and `/auth/confirm` and `/auth/recovery` paths to Supabase's redirect allowlist when testing on a phone.

Use `.env.local` for the variables listed in `.env.example`. Existing local credentials remain there; never commit that file. A fresh database needs migrations 001, 002, and 003 in order. Enable email/password signup with confirmation and set up custom SMTP as described in the upgrade guide.

## Included

- Verified email/password signup, password login without email, and password recovery.
- One-time player name/insignia setup and six selectable geometric marks.
- Up to ten active goals; distinct-day or quantity targets per calendar week/month.
- Full/smaller/skipped day check-ins and editable daily quantity totals.
- Server-calculated daily XP, weekly/monthly bonuses, streaks, grace periods, and target history.
- Archiving/restoring with separate goal runs; preserved earned history.
- Optional AI goal planning via a server-only Groq endpoint with strict output schemas.
- One invited partner, explicitly shared goals/notes, reactions, and shared achievements.
- Mobile-first screens, optional synthesized sounds, reduced motion, and a home-screen manifest.

## Stack and layout

Next.js 16 App Router, React 19, TypeScript, Supabase Auth/PostgreSQL, Groq, Tailwind CSS 4, Radix primitives, and locally bundled Manrope/DM Sans fonts.

```text
app/api/plan/          Authenticated AI endpoint
app/auth/             Confirmation and password recovery pages
components/auth/      Password authentication UI
components/screens/   Today, Goals, Progress, Partner
components/levelup    App shell and modal coordination
lib/use-player        Auth state and authoritative dashboard data
lib/goal-plan         AI schema, request builder, validation
supabase/migrations/  Initial schema and additive upgrade
scripts/reset-project.mjs  Local-only, dry-run-first account reset
docs/UPGRADE.md        Rollout and acceptance guide
```

Daily logs and period bonuses are separate database facts. The `player_dashboard` RPC reconciles elapsed periods and returns only authorized data. Private notes remain in an owner-only table. The Groq key stays server-side; an admin/service-role key is needed only if **you** run the local reset script. Do not add an admin key to Vercel.

## Production

```sh
npm run build
npm start
```

Deploy to Vercel with the existing four app environment variables, and configure the deployed origin in Supabase. This app requires a server runtime for AI planning; it is not a static export. There is no offline write queue, so saving progress requires a connection.

## Verification handoff

Per request, broad automated tests, browser verification, live migrations, data reset, SMTP changes, and deployment were not run for this upgrade. Source was formatted; the [manual acceptance checklist](docs/UPGRADE.md#acceptance-checklist-for-your-verification) covers the requested flows and edge cases.

Available commands for your verification:

```sh
npm run typecheck
npm run lint
npm run build
```
