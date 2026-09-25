# LevelUp

A mobile-first goal practice: three goals, small daily quests, visible progression, and one person in your corner.

## Run locally

Requires Node.js **22.13+** and npm. Dependencies have already been installed in this checkout.

1. Apply `supabase/migrations/001_levelup.sql` once in your Supabase project's **SQL Editor**. This creates the tables, row-level security policies, and atomic functions. The supplied publishable key cannot apply migrations; use the dashboard or your own Supabase CLI credentials. The migration has not been applied automatically.
2. In Supabase **Authentication → URL Configuration**, set **Site URL** to `http://localhost:3000` and add `http://localhost:3000` to **Redirect URLs**. Keep the Email provider enabled and allow new signups. Configure your email sender if you want to invite accounts beyond your project's email delivery restrictions. No custom email template is required: this app uses the default magic link flow.
3. `.env.local` already contains the credentials provided for this local checkout. It is ignored by Git and readable only by its owner. For a fresh checkout, copy `.env.example` to `.env.local` and supply the values. Never prefix the Groq key with `NEXT_PUBLIC_`.
4. Start the application:

```sh
npm run dev
```

Open **http://localhost:3000**. Sign in with your email, then open the emailed link on the same device/browser. Create your first goal manually or with **Help me break it down**. Set your display name in the top-right profile menu.

### On your phone

The dev server binds to `0.0.0.0`. Connect your phone and computer to the same network, then open `http://YOUR_COMPUTER_LAN_IP:3000`. Add that exact origin to Supabase's allowed redirect URLs before signing in. Open the emailed link on the phone. The invitation links use the origin currently open, so use an address both partners can reach. Clipboard support may be limited on plain HTTP; the invitation field can also be selected and copied manually.

### Production

```sh
npm ci
npm run build
npm start
```

Deploy as a normal Node/Next.js application, for example on Vercel or a Node host. Add the deployment origin to Supabase's Site URL and Redirect URLs. Configure the four environment variables on the host; public Supabase values must exist at build time. A Supabase service-role key is **not** required. This is a server-rendered Next.js application with a server API route, not a static export.

## Stack

- Next.js 16 App Router, React 19, strict TypeScript.
- Supabase Auth and PostgreSQL with row-level security and constrained SQL functions.
- Groq's OpenAI-compatible HTTP API, called exclusively by the authenticated server route.
- Tailwind CSS 4 with a custom CSS design system, Radix-based accessible primitives, Lucide icons, Sonner feedback.
- Locally bundled Manrope and DM Sans variable fonts. No external font request at runtime.
- Web Audio synthesis for two optional sounds; no audio download required.

## Included

- Email magic-link sign-in and persistent sessions.
- Three active goals; manual creation and editing; archive/restore; manually tracked milestones.
- User-approved AI suggestions for milestone, action, fallback, cue, schedule, and measurement.
- Scheduled quest days, rest days, full/smaller/skipped check-ins, quantities, private notes, and optional note sharing.
- Past-seven-day entry and editable history. Each check-in is unique per goal/date. One atomic transaction saves the entry and its private note.
- Full quest = 20 XP; smaller step = 10 XP; skipped = 0 XP. Level increases every 100 XP. Corrections recompute earned XP; missing days never deduct it. Archived goals retain their history.
- An evolving emblem at levels 6, 11, 16, and 21, progress animations, and a skippable level-up dialog.
- Weekly completion view, quantities per goal, editable plans, and the 50 latest historical entries.
- One mutually accepted accountability partner, individually shared goals, a shared feed, four reactions, and unread reaction indicators. The UI refreshes visible data every 30 seconds and on window focus.
- Seven-day invitation expiry. Creating a new invitation invalidates the prior one. Accepting an invitation connects both sides atomically. Disconnect removes both sides' access.
- Mobile layout, safe-area-aware navigation, accessible modal focus behavior, optional audio, and system/manual reduced motion.
- Home-screen manifest and original app icon. Requires HTTPS for full installation support. No service worker or offline mutation queue: logging progress requires a connection.
- Optional browser WebMCP enhancement for reading own active goals and opening goal creation. It is feature-detected and unused in unsupported browsers.

## Privacy and authorization

Goals start private. Shared goals reveal their goal details and progress only to the accepted partner. Private notes live in a separate table with owner-only access. The partner sees only an explicitly shared copy attached to a check-in. Turning sharing off revokes future database access to that goal and its entries. Previously viewed information cannot be recalled from another person's memory or screenshots.

The browser uses only the Supabase publishable key, authenticated with the user's access token. PostgreSQL owns permissions, the goal limit, unique check-ins, generated XP, and all connection/reaction writes. The AI endpoint verifies the user's token and consumes a database-backed allowance of 10 requests per UTC day before contacting Groq. Failed upstream attempts count toward that allowance. Only the entered goal description is sent to Groq; private notes and partner data are not sent.

A new profile takes its timezone from the device during sign-in. Saving profile preferences switches it to the current device timezone. Check-in dates are interpreted in the saved profile timezone. The weekly planned-session denominator uses the current goal schedule; historical schedule versions are not stored.

## Files

```text
app/
  page.tsx                 Application entry
  layout.tsx               Metadata and viewport
  globals.css              Responsive design system and motion
  api/plan/route.ts        Authenticated Groq endpoint
components/
  levelup.tsx              Four screens, auth, data, partner flows
  goal-form.tsx            Manual and AI-assisted goal setup
  checkin-form.tsx         Logging and editing progress
  ui/                      Used accessible UI primitives
lib/
  supabase.ts              Browser Supabase client
  model.ts                 Types, date and level helpers
  sound.ts                 Completion and level-up synthesis
  use-webmcp.ts            Optional browser agent interface
supabase/migrations/
  001_levelup.sql          Schema, policies, triggers, RPCs
```

## Verification handoff

Per your request, no build, typecheck, lint, automated tests, browser verification, or live Supabase/Groq calls were run. Dependencies were installed and source was formatted. Optional commands are provided for your own use:

```sh
npm run typecheck
npm run lint
npm run build
```

The SQL migration, authentication configuration, and live integrations still need to be exercised in your project. This source does not ship with fake logged-in data or pretend successful backend actions.
