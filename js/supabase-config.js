const SUPABASE_URL = "https://gkiyrzmlggxiiotypcsz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_RD6-ed-phgYY0qo6m5OlEg_lo2spoLc";

const initialAuthUrl = new URL(window.location.href);
const initialAuthHash = new URLSearchParams(initialAuthUrl.hash.slice(1));
const initialAuthCallback = {
  code: initialAuthUrl.searchParams.get("code"),
  accessToken: initialAuthHash.get("access_token"),
  refreshToken: initialAuthHash.get("refresh_token"),
  error: initialAuthUrl.searchParams.get("error_description")
    || initialAuthHash.get("error_description")
};

window.elimStaffAuthCallbackDetected = Boolean(
  initialAuthCallback.code
  || initialAuthCallback.accessToken
  || initialAuthCallback.error
  || initialAuthHash.get("type") === "magiclink"
);

window.elimSupabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR-PROJECT-REF") &&
  !SUPABASE_ANON_KEY.includes("YOUR-SUPABASE-ANON-KEY");

window.elimSupabase = window.elimSupabaseConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    })
  : null;

let authCallbackPromise = null;

window.elimCompleteAuthCallback = function completeAuthCallback() {
  if (!window.elimSupabase) {
    return Promise.resolve({ data: { session: null }, error: new Error("Supabase is not configured.") });
  }

  if (authCallbackPromise) return authCallbackPromise;

  authCallbackPromise = (async () => {
    if (initialAuthCallback.error) {
      return { data: { session: null }, error: new Error(initialAuthCallback.error) };
    }

    let result;
    if (initialAuthCallback.code) {
      result = await window.elimSupabase.auth.exchangeCodeForSession(initialAuthCallback.code);
    } else if (initialAuthCallback.accessToken && initialAuthCallback.refreshToken) {
      result = await window.elimSupabase.auth.setSession({
        access_token: initialAuthCallback.accessToken,
        refresh_token: initialAuthCallback.refreshToken
      });
    } else {
      result = await window.elimSupabase.auth.getSession();
    }

    if (window.elimStaffAuthCallbackDetected) {
      window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}`);
    }

    return result;
  })();

  return authCallbackPromise;
};
