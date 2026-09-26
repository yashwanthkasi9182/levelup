#!/usr/bin/env node
/** Local maintenance only. Never imported by the app or deployed as an API. */
import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
const EXPECTED_PROJECT = 'juudjdjqteaedsgwatli';
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const projectIndex = args.indexOf('--project-ref');
const explicitProject = projectIndex >= 0 ? args[projectIndex + 1] : undefined;
const allowed = new Set(['--apply', '--project-ref', EXPECTED_PROJECT]);
if (args.some((arg) => !allowed.has(arg)))
  throw new Error(
    'Usage: node --env-file=.env.reset.local scripts/reset-project.mjs [--apply --project-ref juudjdjqteaedsgwatli]',
  );
const url = "https://juudjdjqteaedsgwatli.supabase.co"
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1dWRqZGpxdGVhZWRzZ3dhdGxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDM1MTI5MiwiZXhwIjoyMTA1OTI3MjkyfQ.VsZs36N7st0qGlRtvmK53tlk8Wd-Y6aH76l5en9Xnbk"
if (!url || !key)
  throw new Error(
    'Provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in a local, ignored environment file.',
  );
const host = new URL(url).hostname;
if (host !== `${EXPECTED_PROJECT}.supabase.co`)
  throw new Error('Refusing to access a different Supabase project.');
if (apply && explicitProject !== EXPECTED_PROJECT)
  throw new Error('Destructive mode requires --project-ref juudjdjqteaedsgwatli.');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const tables = [
  'profiles',
  'goals',
  'checkins',
  'notes',
  'partners',
  'invites',
  'reactions',
  'ai_usage',
  'goal_runs',
  'goal_versions',
  'goal_periods',
  'bonuses',
];
const upgradeTables = new Set(['goal_runs', 'goal_versions', 'goal_periods', 'bonuses']);
async function snapshotUsers() {
  const ids = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Cannot list Auth users: ${error.message}`);
    ids.push(...data.users.map((user) => user.id));
    if (data.users.length < 1000) break;
  }
  return [...new Set(ids)];
}
async function counts() {
  const result = {};
  for (const table of tables) {
    const { count, error } = await db.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      if (upgradeTables.has(table) && ['PGRST205', '42P01'].includes(error.code)) {
        result[table] = 'not installed';
        continue;
      }
      throw new Error(`Cannot count ${table}: ${error.message}`);
    }
    result[table] = count;
  }
  return result;
}
try {
  const ids = await snapshotUsers();
  console.log(
    `Project: ${EXPECTED_PROJECT}\nMode: ${apply ? 'DESTRUCTIVE' : 'DRY RUN'}\nAuth users: ${ids.length}`,
  );
  console.table(await counts());
  const { data: buckets, error: bucketError } = await db.storage.listBuckets();
  if (bucketError) throw new Error(`Cannot inspect Storage: ${bucketError.message}`);
  if (buckets?.length) {
    console.log(
      `Storage buckets detected: ${buckets.map((b) => b.name).join(', ')}. No objects will be deleted by this script.`,
    );
    if (apply)
      throw new Error(
        'Storage is outside the current LevelUp schema. Resolve or export Storage objects manually before running this reset.',
      );
  }
  if (!apply) {
    console.log('No changes made. To delete, rerun with --apply --project-ref ' + EXPECTED_PROJECT);
  } else {
    if (!stdin.isTTY) throw new Error('A real terminal is required for typed confirmation.');
    console.log(
      'Pause new signups and stop other app writes before continuing. All listed accounts and cascading LevelUp records will be permanently removed. Schema and project settings stay.',
    );
    const prompt = createInterface({ input: stdin, output: stdout });
    const expected = `DELETE ALL USERS ${EXPECTED_PROJECT}`;
    const confirmation = await prompt.question(`Type ${expected}: `);
    prompt.close();
    if (confirmation !== expected) throw new Error('Confirmation did not match. No users deleted.');
    let deleted = 0;
    const failures = [];
    // Delete the fixed snapshot, never page through a shrinking user list.
    for (const id of ids) {
      const { error } = await db.auth.admin.deleteUser(id, false);
      if (error) {
        failures.push({ id, error: error.message });
        console.error(
          `User ${id}: ${error.message}. Storage-owned objects may block account deletion; resolve manually.`,
        );
      } else deleted++;
    }
    const remaining = await snapshotUsers();
    const after = await counts();
    console.log(
      `Deleted: ${deleted}. Failed: ${failures.length}. Remaining Auth users: ${remaining.length}.`,
    );
    console.table(after);
    if (
      failures.length ||
      remaining.length ||
      Object.values(after).some((v) => typeof v === 'number' && v > 0)
    ) {
      console.error(
        'Reset incomplete. Resolve reported failures or concurrent writes, then rerun.',
      );
      process.exitCode = 1;
    } else console.log('Reset complete. Tables, functions, policies, and configuration preserved.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Reset failed');
  process.exitCode = 1;
}
