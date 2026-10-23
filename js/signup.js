/* ==========================================================================
   KINDRED — Signup Page Logic
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  await guardRoute();

  const avatarPreview = qs("#avatarPreview");
  avatarPreview.src = generateDefaultAvatar("New User");

  // Live preview: URL field
  qs("#avatarUrl").addEventListener("input", (e) => {
    avatarPreview.src = e.target.value ? e.target.value : generateDefaultAvatar(qs("#firstName").value || "New User");
  });
  // Live preview: file field
  qs("#avatarFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) avatarPreview.src = await fileToDataUrl(file);
  });
  // Update default preview as the name is typed (only if no custom pic chosen yet)
  qs("#firstName").addEventListener("input", () => {
    if (!qs("#avatarUrl").value && !qs("#avatarFile").files.length) {
      avatarPreview.src = generateDefaultAvatar(`${qs("#firstName").value} ${qs("#lastName").value}`);
    }
  });

  // Show/hide password
  qs('[data-toggle-for="password"]').addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const input = qs("#password");
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    btn.innerHTML = `<i class="bi ${showing ? "bi-eye" : "bi-eye-slash"}"></i>`;
  });

  qs("#googleBtn").addEventListener("click", async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      showToast(friendlyAuthError(err), "error");
    }
  });

  qs("#signupForm").addEventListener("submit", handleSignup);
});

function validateSignupForm() {
  let valid = true;
  const required = [
    ["#firstName", "First name is required."],
    ["#lastName", "Last name is required."],
    ["#username", "Choose a username."],
    ["#email", "Email is required."],
    ["#password", "Password is required."],
  ];
  required.forEach(([sel, msg]) => {
    const input = qs(sel);
    const errorEl = input.closest(".k-field").querySelector(".k-error-text");
    if (!input.value.trim()) {
      setFieldError(input, errorEl, msg);
      valid = false;
    } else {
      setFieldError(input, errorEl, null);
    }
  });

  const email = qs("#email");
  if (email.value && !/^\S+@\S+\.\S+$/.test(email.value)) {
    setFieldError(email, email.closest(".k-field").querySelector(".k-error-text"), "Enter a valid email address.");
    valid = false;
  }

  const username = qs("#username");
  if (username.value && !/^[a-zA-Z0-9_.]{3,20}$/.test(username.value)) {
    setFieldError(username, username.closest(".k-field").querySelector(".k-error-text"), "3-20 letters, numbers, underscores or dots.");
    valid = false;
  }

  const password = qs("#password");
  if (password.value && password.value.length < 6) {
    setFieldError(password, password.closest(".k-field").querySelector(".k-error-text"), "At least 6 characters.");
    valid = false;
  }

  return valid;
}

async function handleSignup(e) {
  e.preventDefault();
  const errorBox = qs("#formErrorBox");
  errorBox.style.display = "none";

  if (!validateSignupForm()) return;
  if (!isSupabaseConfigured()) {
    showToast("Add your Supabase URL + anon key in js/supabase-config.js first.", "error", 5000);
    return;
  }

  const btn = qs("#signupBtn");
  setButtonLoading(btn, true, "Creating account...");

  try {
    const profileFields = {
      first_name: qs("#firstName").value.trim(),
      last_name: qs("#lastName").value.trim(),
      username: qs("#username").value.trim().toLowerCase(),
      age: qs("#age").value ? parseInt(qs("#age").value, 10) : null,
      gender: qs("#gender").value || null,
      city: qs("#city").value.trim() || null,
      country: qs("#country").value.trim() || null,
      bio: qs("#bio").value.trim(),
      avatar_url: qs("#avatarUrl").value.trim() || null,
      cover_url: qs("#coverUrl").value.trim() || null,
    };

    const { user } = await signUpWithEmail({
      email: qs("#email").value.trim(),
      password: qs("#password").value,
      profileFields,
    });

    // Handle file uploads (take priority over URL if provided)
    const avatarFile = qs("#avatarFile").files[0];
    const coverFile = qs("#coverFile").files[0];
    if (user && (avatarFile || coverFile)) {
      const updates = {};
      if (avatarFile) updates.avatar_url = await uploadToBucket(STORAGE_BUCKETS.avatars, avatarFile, user.id);
      if (coverFile) updates.cover_url = await uploadToBucket(STORAGE_BUCKETS.covers, coverFile, user.id);
      await supabaseClient.from("profiles").update(updates).eq("id", user.id);
    }

    showToast("Welcome to Kindred! Redirecting...", "success");
    setTimeout(() => (window.location.href = "dashboard.html"), 900);
  } catch (err) {
    errorBox.style.display = "block";
    errorBox.querySelector(".alert").textContent = friendlyAuthError(err);
    showToast(friendlyAuthError(err), "error");
  } finally {
    setButtonLoading(btn, false);
  }
}
