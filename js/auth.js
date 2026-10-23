/* ==========================================================================
   KINDRED — Auth Module
   Handles Supabase auth (email/password + Google), session checks,
   route protection, and profile row bootstrapping.
   ========================================================================== */

const PUBLIC_PAGES = ["login.html", "signup.html", "index.html", ""];

function currentPage() {
  return window.location.pathname.split("/").pop();
}

/** Redirects unauth'd users away from protected pages, and auth'd users away from login/signup. */
async function guardRoute() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const page = currentPage();
  const isPublic = PUBLIC_PAGES.includes(page);

  if (!session && !isPublic) {
    window.location.href = "login.html";
    return null;
  }
  if (session && (page === "login.html" || page === "signup.html")) {
    window.location.href = "homefeed.html";
    return null;
  }
  return session;
}

/** Fetches (or lazily creates) the profiles row for the current user. */
async function getMyProfile() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return null;

  let { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // First login via Google (or a profile row that never got created) — bootstrap one.
    const meta = user.user_metadata || {};
    const fallbackName = meta.full_name || meta.name || user.email.split("@")[0];
    const newProfile = {
      id: user.id,
      first_name: meta.given_name || fallbackName.split(" ")[0] || "New",
      last_name: meta.family_name || fallbackName.split(" ").slice(1).join(" ") || "User",
      username: (meta.preferred_username || user.email.split("@")[0] || "user").toLowerCase().replace(/[^a-z0-9_]/g, ""),
      email: user.email,
      avatar_url: meta.avatar_url || meta.picture || null,
      bio: "",
    };
    const { data: created } = await supabaseClient.from("profiles").insert(newProfile).select().single();
    profile = created || newProfile;
  }
  return profile;
}

async function signUpWithEmail({ email, password, profileFields }) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: `${profileFields.first_name} ${profileFields.last_name}` } },
  });
  if (error) throw error;

  const userId = data.user?.id;
  if (userId) {
    const { error: profileError } = await supabaseClient.from("profiles").insert({
      id: userId,
      email,
      ...profileFields,
    });
    if (profileError) throw profileError;
  }
  return data;
}

async function signInWithEmail({ email, password }) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signInWithGoogle() {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/dashboard.html` },
  });
  if (error) throw error;
}

async function signOut() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

/** Uploads a File to a storage bucket and returns its public URL. */
async function uploadToBucket(bucket, file, userId) {
  const ext = file.name.split(".").pop();
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabaseClient.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabaseClient.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function friendlyAuthError(error) {
  const msg = (error?.message || "").toLowerCase();
  if (msg.includes("invalid login credentials")) return "That email or password doesn't look right.";
  if (msg.includes("already registered") || msg.includes("already exists")) return "An account with this email already exists.";
  if (msg.includes("password") && msg.includes("6")) return "Password must be at least 6 characters.";
  if (msg.includes("email") && msg.includes("valid")) return "Please enter a valid email address.";
  if (msg.includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";
  return error?.message || "Something went wrong. Please try again.";
}
