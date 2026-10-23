/* ==========================================================================
   KINDRED — Supabase Client Configuration
   --------------------------------------------------------------------------
   1. Create a project at https://supabase.com
   2. Go to Project Settings -> API and copy your Project URL + anon public key
   3. Paste them below.
   4. Run the SQL in /supabase/schema.sql inside the Supabase SQL editor.
   5. Create three PUBLIC storage buckets named exactly:
        avatars, covers, posts
      (Storage -> New bucket -> toggle "Public bucket" on)
   6. Enable Google auth: Authentication -> Providers -> Google (add your
      OAuth client id/secret from Google Cloud Console), and add
      your site URL + `/dashboard.html` to Redirect URLs.
   ========================================================================== */

const SUPABASE_URL = "https://azdzupxbazkrkuwwpuyx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_RHvzIStgB-rUyYvowg5cFA_iL5gLRCR";

// Loaded via CDN script tag in every HTML page:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const STORAGE_BUCKETS = {
  avatars: "avatars",
  covers: "covers",
  posts: "posts",
};

function isSupabaseConfigured() {
  return !SUPABASE_URL.includes("YOUR-PROJECT-REF") && !SUPABASE_ANON_KEY.includes("YOUR-SUPABASE");
}
