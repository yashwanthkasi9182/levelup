import { createClient } from '@supabase/supabase-js';

function cleanPublicEnv(value: string | undefined, fallback: string) {
  return (value || fallback)
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^\x20-\x7E]/g, '');
}

const supabaseUrl = cleanPublicEnv(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  'https://placeholder.supabase.co',
);
const supabasePublishableKey = cleanPublicEnv(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  'configure-your-key',
);

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
