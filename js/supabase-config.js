const SUPABASE_URL = "https://gkiyrzmlggxiiotypcsz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_RD6-ed-phgYY0qo6m5OlEg_lo2spoLc";

window.elimSupabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR-PROJECT-REF") &&
  !SUPABASE_ANON_KEY.includes("YOUR-SUPABASE-ANON-KEY");

window.elimSupabase = window.elimSupabaseConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
