import { createClient } from '@supabase/supabase-js';

// Vercel does not upload .env.local from GitHub. These public Supabase values
// therefore act as a deployment fallback. Environment variables still take
// precedence when they are configured later in Vercel.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://gddgdytgxladcxhrivlm.supabase.co';

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_RWl3KE9bi_xUQzjCKUPMAg_T_HW4mcn';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
