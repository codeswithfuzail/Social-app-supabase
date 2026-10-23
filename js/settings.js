/* ==========================================================================
   KINDRED — Settings Page Logic
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  await guardRoute();
  const profile = await renderAppShell("settings.html");
  if (!profile) return;
  qs("#topbarAvatar").src = resolveAvatar(profile);

  wireTabs();
  populateForm(profile);

  qs("#profileForm").addEventListener("submit", (e) => handleProfileSave(e));
  qs("#saveAvatarBtn").addEventListener("click", handleAvatarSave);
  qs("#saveCoverBtn").addEventListener("click", handleCoverSave);
  qs("#passwordForm").addEventListener("submit", handlePasswordChange);
  qs("#logoutBtn").addEventListener("click", () => signOut());
  qs("#deleteAccountBtn").addEventListener("click", handleDeleteAccount);

  qs("#stAvatarUrl").addEventListener("input", (e) => { if (e.target.value) qs("#stAvatarPreview").src = e.target.value; });
  qs("#stAvatarFile").addEventListener("change", async (e) => { if (e.target.files[0]) qs("#stAvatarPreview").src = await fileToDataUrl(e.target.files[0]); });
  qs("#stCoverUrl").addEventListener("input", (e) => { if (e.target.value) qs("#stCoverPreview").src = e.target.value; });
  qs("#stCoverFile").addEventListener("change", async (e) => { if (e.target.files[0]) qs("#stCoverPreview").src = await fileToDataUrl(e.target.files[0]); });

  qsa(".k-theme-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.themeBtn === (localStorage.getItem("kindred-theme") || "dark"));
    card.addEventListener("click", () => {
      applyTheme(card.dataset.themeBtn);
      qsa(".k-theme-card").forEach((c) => c.classList.toggle("active", c === card));
    });
  });
});

function wireTabs() {
  qsa(".k-settings-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      qsa(".k-settings-tab").forEach((t) => t.classList.remove("active"));
      qsa(".k-settings-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      qs(`#panel-${tab.dataset.tab}`).classList.add("active");
    });
  });
}

function populateForm(profile) {
  qs("#stFirstName").value = profile.first_name || "";
  qs("#stLastName").value = profile.last_name || "";
  qs("#stUsername").value = profile.username || "";
  qs("#stAge").value = profile.age || "";
  qs("#stGender").value = profile.gender || "";
  qs("#stCity").value = profile.city || "";
  qs("#stCountry").value = profile.country || "";
  qs("#stBio").value = profile.bio || "";
  qs("#stAvatarPreview").src = resolveAvatar(profile);
  qs("#stCoverPreview").src = resolveCover(profile);
}

async function handleProfileSave(e) {
  e.preventDefault();
  const btn = qs("#saveProfileBtn");
  setButtonLoading(btn, true, "Saving...");
  try {
    const userId = await ensureCurrentUserSettings();
    const { error } = await supabaseClient.from("profiles").update({
      first_name: qs("#stFirstName").value.trim(),
      last_name: qs("#stLastName").value.trim(),
      username: qs("#stUsername").value.trim().toLowerCase(),
      age: qs("#stAge").value ? parseInt(qs("#stAge").value, 10) : null,
      gender: qs("#stGender").value || null,
      city: qs("#stCity").value.trim() || null,
      country: qs("#stCountry").value.trim() || null,
      bio: qs("#stBio").value.trim(),
    }).eq("id", userId);
    if (error) throw error;
    showToast("Profile updated.", "success");
  } catch (err) {
    showToast(err.message || "Couldn't save changes.", "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

async function ensureCurrentUserSettings() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user.id;
}

async function handleAvatarSave() {
  const btn = qs("#saveAvatarBtn");
  setButtonLoading(btn, true, "Updating...");
  try {
    const userId = await ensureCurrentUserSettings();
    const file = qs("#stAvatarFile").files[0];
    const url = qs("#stAvatarUrl").value.trim();
    let avatar_url = null;
    if (file) avatar_url = await uploadToBucket(STORAGE_BUCKETS.avatars, file, userId);
    else if (url) avatar_url = url;
    else { showToast("Add a URL or choose a file first.", "error"); setButtonLoading(btn, false); return; }

    const { error } = await supabaseClient.from("profiles").update({ avatar_url }).eq("id", userId);
    if (error) throw error;
    showToast("Profile picture updated.", "success");
    qs("#topbarAvatar").src = avatar_url;
    const shellAvatar = qs("#shellAvatar");
    if (shellAvatar) shellAvatar.src = avatar_url;
  } catch (err) {
    showToast(err.message || "Couldn't update picture.", "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

async function handleCoverSave() {
  const btn = qs("#saveCoverBtn");
  setButtonLoading(btn, true, "Updating...");
  try {
    const userId = await ensureCurrentUserSettings();
    const file = qs("#stCoverFile").files[0];
    const url = qs("#stCoverUrl").value.trim();
    let cover_url = null;
    if (file) cover_url = await uploadToBucket(STORAGE_BUCKETS.covers, file, userId);
    else if (url) cover_url = url;
    else { showToast("Add a URL or choose a file first.", "error"); setButtonLoading(btn, false); return; }

    const { error } = await supabaseClient.from("profiles").update({ cover_url }).eq("id", userId);
    if (error) throw error;
    showToast("Cover image updated.", "success");
  } catch (err) {
    showToast(err.message || "Couldn't update cover.", "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

async function handlePasswordChange(e) {
  e.preventDefault();
  const pw = qs("#newPassword").value;
  const confirm = qs("#confirmPassword").value;
  if (pw.length < 6) return showToast("Password must be at least 6 characters.", "error");
  if (pw !== confirm) return showToast("Passwords don't match.", "error");

  const btn = qs("#changePasswordBtn");
  setButtonLoading(btn, true, "Updating...");
  try {
    const { error } = await supabaseClient.auth.updateUser({ password: pw });
    if (error) throw error;
    showToast("Password changed successfully.", "success");
    qs("#passwordForm").reset();
  } catch (err) {
    showToast(friendlyAuthError(err), "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

async function handleDeleteAccount() {
  const sure = confirm("This will permanently delete your account and all your data. This cannot be undone. Continue?");
  if (!sure) return;
  try {
    const userId = await ensureCurrentUserSettings();
    // Clean up owned rows (RLS-safe: only the user's own rows can be deleted this way).
    await supabaseClient.from("posts").delete().eq("user_id", userId);
    await supabaseClient.from("profiles").delete().eq("id", userId);
    showToast("Account data deleted. Note: full auth-account removal requires a server-side admin call.", "info", 6000);
    setTimeout(() => signOut(), 1500);
  } catch (err) {
    showToast(err.message || "Couldn't delete account.", "error");
  }
}
