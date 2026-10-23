/* ==========================================================================
   KINDRED — Login Page Logic
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  await guardRoute();

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

  qs("#loginForm").addEventListener("submit", handleLogin);
});

async function handleLogin(e) {
  e.preventDefault();
  const errorBox = qs("#formErrorBox");
  errorBox.style.display = "none";

  const email = qs("#email");
  const password = qs("#password");
  let valid = true;
  if (!email.value.trim()) { setFieldError(email, email.closest(".k-field").querySelector(".k-error-text"), "Email is required."); valid = false; }
  else setFieldError(email, email.closest(".k-field").querySelector(".k-error-text"), null);
  if (!password.value) { setFieldError(password, password.closest(".k-field").querySelector(".k-error-text"), "Password is required."); valid = false; }
  else setFieldError(password, password.closest(".k-field").querySelector(".k-error-text"), null);
  if (!valid) return;

  if (!isSupabaseConfigured()) {
    showToast("Add your Supabase URL + anon key in js/supabase-config.js first.", "error", 5000);
    return;
  }

  const btn = qs("#loginBtn");
  setButtonLoading(btn, true, "Logging in...");
  try {
    await signInWithEmail({ email: email.value.trim(), password: password.value });
    showToast("Welcome back!", "success");
    setTimeout(() => (window.location.href = "homefeed.html"), 600);
  } catch (err) {
    errorBox.style.display = "block";
    errorBox.querySelector(".alert").textContent = friendlyAuthError(err);
    showToast(friendlyAuthError(err), "error");
  } finally {
    setButtonLoading(btn, false);
  }
}
