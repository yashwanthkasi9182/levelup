# Flexible goals upgrade

This release adds email/password auth, one-time player setup, flexible weekly/monthly targets, server-calculated bonuses, and six player insignias. It does not change your deployed Supabase configuration automatically.

## Deployment order

1. In Supabase Authentication, temporarily disable **Allow new users to sign up**. Avoid app writes during migration/reset. Export any data you want to retain.
2. If starting fresh, run the optional reset below. Otherwise retain all accounts and history. Existing passwordless accounts can use **Forgot password** to set a password after this deployment.
3. Run `supabase/migrations/002_flexible_goals.sql` in the SQL Editor of your existing project. **Do not rerun migration 001.** The new migration is transactional and intended to run once. A completely new database needs 001 followed by 002.
4. Deploy this release to Vercel. Keep the existing public Supabase URL/key and server-only Groq environment variables. No admin key is needed by the deployed application.
5. Configure custom SMTP, auth URLs, password rules, and email templates below.
6. Reenable signup. Complete the acceptance checklist before inviting real users.

Migration 002 preserves existing users, goals, notes, and XP. Active fixed-weekday goals become flexible weekly day targets with the same number of days. Existing check-ins remain legacy history; they do not create retroactive bonuses. Profiles with no onboarding timestamp must choose their name and insignia once.

## Supabase authentication

Under Authentication settings:

- Enable Email provider and **Confirm email**.
- Set minimum password length to **12**. The new signup and password-reset forms enforce the same minimum.
- Enable **Allow new users to sign up** only after setup is finished.
- Set Site URL to `https://levelupwithpartner.vercel.app`.
- Allow these redirect URLs (restrict to your own host):

```text
https://levelupwithpartner.vercel.app
https://levelupwithpartner.vercel.app/
https://levelupwithpartner.vercel.app/auth/confirm
https://levelupwithpartner.vercel.app/auth/confirm?invite=*
https://levelupwithpartner.vercel.app/auth/recovery
https://levelupwithpartner.vercel.app/auth/recovery?invite=*
http://localhost:3000/**
```

The UUID invitation contains no slash, so the query wildcard permits its value without authorizing another origin. Remove localhost when no longer needed. If you use a custom domain, update the Site URL and mirror these paths on that domain.

Configure **Custom SMTP** with an email provider and a verified sender/domain. Supabase's default sender is restricted and not suitable for arbitrary new users. Password login sends no email, but signup confirmation, confirmation resend, and recovery still use your email quota. Keep provider click tracking disabled for authentication messages so the verification links are not rewritten.

### Confirm signup template

Subject: `Confirm your LevelUp account`

```html
<h2>Welcome to LevelUp</h2>
<p>Confirm your email to create your player.</p>
<p><a href="{{ .ConfirmationURL }}">Confirm email</a></p>
<p>If you did not request this account, ignore this email.</p>
```

### Reset password template

Subject: `Reset your LevelUp password`

```html
<h2>Reset your password</h2>
<p><a href="{{ .ConfirmationURL }}">Choose a new password</a></p>
<p>If you did not request a reset, ignore this email.</p>
```

Keep `{{ .ConfirmationURL }}` intact: Supabase verifies the token, then redirects to the requested confirmation/recovery route. Do not replace it with SiteURL, RedirectTo, or a raw application link. No magic-link login UI remains. The “Invite user” template is not used by partner invitations.

Confirmation and recovery carry the pending partner UUID in the redirect URL, with browser storage as a fallback. Thus a signup confirmation opened on another device can retain the invitation. Existing-user login remains in the same tab. The app opens Partner after player setup; accepting a relationship always remains an explicit action.

## Optional fresh-start reset

The script is delivered but **has not been run**. It permanently removes every Auth account and cascading LevelUp records in the dedicated project `juudjdjqteaedsgwatli`. It preserves schema, RLS policies, SQL functions, email templates, and settings.

Create an ignored `.env.reset.local` on your own computer:

```dotenv
SUPABASE_URL=https://juudjdjqteaedsgwatli.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-admin-key
```

Use a Supabase admin/service-role key, not the publishable key. Alternatively use the newer secret key under `SUPABASE_SECRET_KEY`. Never put either key in a `NEXT_PUBLIC_` variable, Git, Vercel, or browser code. The existing `.gitignore` excludes this file.

Dry run (read-only):

```sh
node --env-file=.env.reset.local scripts/reset-project.mjs
```

Delete only when ready, in an interactive terminal:

```sh
node --env-file=.env.reset.local scripts/reset-project.mjs --apply --project-ref juudjdjqteaedsgwatli
```

Type the exact confirmation printed by the script. It snapshots all user IDs before deletion, so pagination cannot skip accounts. It reports failures and remaining row counts. Re-running after a partial failure is safe. Storage buckets are not part of this app; if any exist, destructive mode stops for manual review rather than deleting their objects. Delete the local admin-key file when finished. Sign out of old app sessions and clear any stale local invitation before creating fresh accounts.

## Period and reward rules

- Goals keep their creation timezone, even when profile timezone changes. Weeks are Monday–Sunday; months are calendar months.
- Day targets count distinct full-action dates. Full action earns 20 XP, smaller action 10 XP, skipped 0 XP.
- Quantity logging edits **Today's total**. Positive totals earn 20 XP per goal/date; zero earns 0 XP. Saving the same day again does not grant more daily XP.
- Direct target bonuses: weekly 50 XP, monthly 100 XP, awarded once when the target is met.
- Weekly goals additionally earn 100 XP for monthly consistency, after month-end, when all full required weeks ending in that month are successful. At least one full week is required; the run must remain active through month-end. A month containing a transition to monthly scheduling does not also receive a weekly-consistency bonus.
- Starting partway through a period is a grace period. Full target completion can earn a bonus; missing it does not break the streak. The first full period has the normal target.
- Monthly day targets can be up to 31, but select a target that is achievable in shorter months; the app does not automatically prorate it.
- Target edits take effect at the next current boundary. Editing back to the current target cancels the pending change. History keeps its original period configuration.
- Archive ends a run; restore starts a new run and streak. If a date already has a check-in from an earlier run, editing it corrects that earlier record rather than duplicating it in the new run.
- Corrections recalculate period totals, affected bonuses, levels, and streaks. These can decrease when previously recorded progress was incorrect.
- Period reconciliation happens transactionally on dashboard reads and check-in writes. You do not need a cron job or to open the app at midnight.

All reward writes occur through restricted SQL functions. The browser cannot directly edit period/bonus tables, goal configuration, or onboarding completion. Dashboard responses include only your private data and your currently accepted partner's explicitly shared goals.

## Acceptance checklist (for your verification)

No broad automated suite, browser checks, live migration, SMTP configuration, reset, or deployment was executed during implementation.

### Auth and player

- Sign up using a 12+ character password; confirm email, then complete name/insignia setup. Password login must send no email.
- Refresh before setup save: setup remains required. Refresh/sign in on another device after save: setup stays completed.
- Confirm with an expired/reused link, resend, and verify the error/recovery states.
- Reset password, select a new password, and log in with it. Old password must fail.
- Open a partner invitation, sign up, confirm in another browser, finish setup, and accept the preserved invitation. Invalid/self/expired/already-used invitations must fail clearly.

### Flexible targets and reward corrections

- Create 5 days/week. Four full dates + one smaller date must show 4/5. Upgrade the smaller date: 5/5, one 50 XP bonus. Re-save/reload/open two tabs: no duplicate bonus.
- Create 10 questions/month. Save 2 today, edit to 5: total 5, 20 daily XP. Save 5 on another active date: total 10, another daily reward and one 100 XP bonus.
- Change the total back below target: bonus disappears and XP/streaks update. Restore the total: one bonus returns.
- Start on a Wednesday. Missing that initial partial week is neutral; completing it earns a bonus. Check Monday boundaries, February, leap years, and goal-local timezone boundaries.
- For weekly consistency, all eligible weeks ending in a month must succeed; the last incomplete week must block the monthly bonus. Correct an earlier week downward and verify the monthly bonus is revoked.
- An open unfinished week/month must not reset the previous streak. A closed missed required period must reset it.
- Edit a target mid-period. Verify current target remains, pending target is shown, and the next period uses it. Switch week/month and days/quantity without reinterpreting old logs.
- Archive, then restore. XP/history stay; the new run cannot bridge old streaks. Same-day edits cannot duplicate credit across runs.

### Privacy, cleanup, and UI

- Use a third account to verify private goals/notes and restricted reward tables cannot be read or written.
- Disconnect a partner or unshare a goal: its data must stop appearing to the other account. Private notes must never appear unless an entry's shared-note switch is enabled.
- Run reset dry-run and compare counts: unchanged. On disposable data, run explicit reset: no Auth users or app rows remain, schema/policies/functions still exist.
- Verify 320/390/768px widths, large text, keyboard focus, password-manager autofill, sound toggle, system/manual reduced motion, and long goal names.
