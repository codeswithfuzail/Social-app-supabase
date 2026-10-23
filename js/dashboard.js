/* ==========================================================================
   KINDRED — Dashboard Page Logic
   ========================================================================== */

const __viewedUserId = new URLSearchParams(window.location.search).get("user");

document.addEventListener("DOMContentLoaded", async () => {
  await guardRoute();
  await renderAppShell("dashboard.html");
  await ensureCurrentUser();

  wireCreatePostForm(loadDashboard);
  attachPostActionHandlers(qs("#myPostsList"), loadMyPosts);
  qs("#editProfileForm").addEventListener("submit", handleEditProfile);

  const isOwnProfile = !__viewedUserId || __viewedUserId === __kindredCurrentUserId;
  if (!isOwnProfile) {
    qs("#profileActionButtons")?.remove(); // hide Edit/Create buttons
  }

  await loadDashboard();
});

async function loadDashboard() {
  const isOwnProfile = !__viewedUserId || __viewedUserId === __kindredCurrentUserId;
  let profile;
  if (isOwnProfile) {
    profile = await getMyProfile();
  } else {
    const { data } = await supabaseClient.from("profiles").select("*").eq("id", __viewedUserId).maybeSingle();
    profile = data;
  }
  if (!profile) { qs("#profileFullName").textContent = "User not found"; return; }

  const myProfile = await getMyProfile();
  qs("#topbarAvatar").src = resolveAvatar(myProfile);
  qs("#coverImg").src = resolveCover(profile);
  qs("#profileAvatar").src = resolveAvatar(profile);
  qs("#profileFullName").textContent = `${profile.first_name} ${profile.last_name}`.trim();
  qs("#profileUsername").textContent = `@${profile.username}`;
  qs("#profileBio").textContent = profile.bio || "No bio yet.";

  const meta = [];
  if (profile.city || profile.country) meta.push(`<span><i class="bi bi-geo-alt me-1"></i>${[profile.city, profile.country].filter(Boolean).join(", ")}</span>`);
  if (profile.age) meta.push(`<span><i class="bi bi-cake2 me-1"></i>${profile.age} yrs</span>`);
  if (profile.gender) meta.push(`<span><i class="bi bi-person me-1"></i>${escapeHtml(profile.gender)}</span>`);
  qs("#profileMeta").innerHTML = meta.join("");

  qs("#profileDetailsCard").innerHTML = `
    <div><i class="bi bi-envelope me-2"></i>${escapeHtml(profile.email)}</div>
    ${profile.city ? `<div><i class="bi bi-buildings me-2"></i>${escapeHtml(profile.city)}</div>` : ""}
    ${profile.country ? `<div><i class="bi bi-flag me-2"></i>${escapeHtml(profile.country)}</div>` : ""}
    <div><i class="bi bi-calendar3 me-2"></i>Joined ${new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
  `;

  // Prefill edit form
  qs("#editFirstName").value = profile.first_name || "";
  qs("#editLastName").value = profile.last_name || "";
  qs("#editUsername").value = profile.username || "";
  qs("#editAge").value = profile.age || "";
  qs("#editGender").value = profile.gender || "";
  qs("#editCity").value = profile.city || "";
  qs("#editCountry").value = profile.country || "";
  qs("#editBio").value = profile.bio || "";

  const { data: stats } = await supabaseClient.from("profile_stats").select("*").eq("profile_id", profile.id).maybeSingle();
  qs("#statPosts").textContent = stats?.posts_count ?? 0;
  qs("#statFollowers").textContent = stats?.followers_count ?? 0;
  qs("#statFollowing").textContent = stats?.following_count ?? 0;

  await loadMyPosts();
}

async function loadMyPosts() {
  const list = qs("#myPostsList");
  list.innerHTML = `<div class="k-skel" style="height:140px;" class="mb-3"></div>`;
  try {
    await ensureCurrentUser();
    const targetId = __viewedUserId || __kindredCurrentUserId;
    const posts = await fetchPosts({ userId: targetId });
    renderPostsInto(list, posts, "Share your first post with Create Post above.");
  } catch (err) {
    list.innerHTML = `<div class="k-empty">Couldn't load posts.</div>`;
  }
}

async function handleEditProfile(e) {
  e.preventDefault();
  const btn = qs("#editProfileBtn");
  setButtonLoading(btn, true, "Saving...");
  try {
    const userId = await ensureCurrentUser();
    const updates = {
      first_name: qs("#editFirstName").value.trim(),
      last_name: qs("#editLastName").value.trim(),
      username: qs("#editUsername").value.trim().toLowerCase(),
      age: qs("#editAge").value ? parseInt(qs("#editAge").value, 10) : null,
      gender: qs("#editGender").value || null,
      city: qs("#editCity").value.trim() || null,
      country: qs("#editCountry").value.trim() || null,
      bio: qs("#editBio").value.trim(),
    };
    const { error } = await supabaseClient.from("profiles").update(updates).eq("id", userId);
    if (error) throw error;
    showToast("Profile updated.", "success");
    bootstrap.Modal.getInstance(qs("#editProfileModal"))?.hide();
    __kindredMyProfile = null;
    await loadDashboard();
  } catch (err) {
    showToast(err.message || "Couldn't update profile.", "error");
  } finally {
    setButtonLoading(btn, false);
  }
}