/* ==========================================================================
   KINDRED — Search Page Logic
   ========================================================================== */

let __searchDebounce = null;
let __myFollowingIds = new Set();

document.addEventListener("DOMContentLoaded", async () => {
  await guardRoute();
  const profile = await renderAppShell("search.html");
  if (profile) qs("#topbarAvatar").src = resolveAvatar(profile);

  await loadMyFollowing();
  await loadAllUsers();

  qs("#searchInput").addEventListener("input", (e) => {
    clearTimeout(__searchDebounce);
    const term = e.target.value.trim();
    __searchDebounce = setTimeout(() => (term ? runSearch(term) : loadAllUsers()), 300);
  });

  qs("#searchResults").addEventListener("click", async (e) => {
    const btn = e.target.closest(".k-follow-btn");
    if (btn) await toggleFollow(btn);
  });
});

/** Shows every user on the platform (with live follower/following counts) when the search box is empty. */
async function loadAllUsers() {
  const results = qs("#searchResults");
  results.innerHTML = `<div class="k-skel mb-2" style="height:78px;"></div><div class="k-skel mb-2" style="height:78px;"></div><div class="k-skel mb-2" style="height:78px;"></div>`;

  const { data: { user } } = await supabaseClient.auth.getUser();
  const { data: users, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .neq("id", user?.id || "00000000-0000-0000-0000-000000000000")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !users || !users.length) {
    return renderEmptyState("No other users have joined Kindred yet.", "bi-people");
  }

  const ids = users.map((u) => u.id);
  const { data: stats } = await supabaseClient.from("profile_stats").select("*").in("profile_id", ids);
  const statsMap = new Map((stats || []).map((s) => [s.profile_id, s]));

  qs("#searchResults").innerHTML = `<h6 class="text-muted mb-3">All members (${users.length})</h6>` +
    users.map((u) => userRowHtml(u, statsMap.get(u.id))).join("");
}

async function loadMyFollowing() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;
  const { data } = await supabaseClient.from("follows").select("following_id").eq("follower_id", user.id);
  __myFollowingIds = new Set((data || []).map((f) => f.following_id));
}

function renderEmptyState(message, icon = "bi-search") {
  qs("#searchResults").innerHTML = `
    <div class="k-empty">
      <div class="k-empty-icon"><i class="bi ${icon}"></i></div>
      <h5>Nothing to show</h5>
      <p class="mb-0">${message}</p>
    </div>`;
}

async function runSearch(term) {
  const results = qs("#searchResults");
  if (!term) return renderEmptyState("Search for people by name or username to get started.", "bi-people");

  results.innerHTML = `<div class="k-skel mb-2" style="height:78px;"></div><div class="k-skel mb-2" style="height:78px;"></div>`;

  const { data: { user } } = await supabaseClient.auth.getUser();
  const { data: users, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .or(`username.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
    .neq("id", user?.id || "00000000-0000-0000-0000-000000000000")
    .limit(20);

  if (error || !users || !users.length) {
    return renderEmptyState(`No one matches "${escapeHtml(term)}". Try a different name or username.`, "bi-emoji-frown");
  }

  const ids = users.map((u) => u.id);
  const { data: stats } = await supabaseClient.from("profile_stats").select("*").in("profile_id", ids);
  const statsMap = new Map((stats || []).map((s) => [s.profile_id, s]));

  results.innerHTML = users.map((u) => userRowHtml(u, statsMap.get(u.id))).join("");
}

function userRowHtml(u, stats) {
  const isFollowing = __myFollowingIds.has(u.id);
  const followers = stats?.followers_count ?? 0;
  const following = stats?.following_count ?? 0;
  return `
  <div class="k-card k-user-row hoverable">
    <img src="${resolveAvatar(u)}" class="k-avatar" width="52" height="52" alt="${escapeHtml(u.username)}">
    <div class="k-user-info">
      <div class="fw-semibold">${escapeHtml(u.first_name)} ${escapeHtml(u.last_name)}</div>
      <div class="text-muted small">@${escapeHtml(u.username)} · <span title="Followers">${followers} followers</span> · <span title="Following">${following} following</span></div>
      ${u.bio ? `<div class="small mt-1 text-truncate">${escapeHtml(u.bio)}</div>` : ""}
    </div>
    <button class="btn-k ${isFollowing ? "btn-k-outline" : "btn-k-primary"} k-follow-btn" data-id="${u.id}" data-following="${isFollowing}">
      ${isFollowing ? "Following" : "Follow"}
    </button>
    <a href="dashboard.html?user=${u.id}" class="btn-k btn-k-ghost">View</a>
  </div>`;
}

async function toggleFollow(btn) {
  const targetId = btn.dataset.id;
  const isFollowing = btn.dataset.following === "true";
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  btn.disabled = true;
  const countsEl = btn.closest(".k-user-row").querySelector(".k-user-info .text-muted");
  try {
    if (isFollowing) {
      await supabaseClient.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetId);
      __myFollowingIds.delete(targetId);
      btn.textContent = "Follow";
      btn.className = "btn-k btn-k-primary k-follow-btn";
      btn.dataset.following = "false";
    } else {
      await supabaseClient.from("follows").insert({ follower_id: user.id, following_id: targetId });
      __myFollowingIds.add(targetId);
      btn.textContent = "Following";
      btn.className = "btn-k btn-k-outline k-follow-btn";
      btn.dataset.following = "true";
    }
    // Refresh this row's live follower count from the DB so it's immediately visible.
    const { data: freshStats } = await supabaseClient.from("profile_stats").select("*").eq("profile_id", targetId).maybeSingle();
    if (freshStats && countsEl) {
      const usernameMatch = countsEl.textContent.split("·")[0];
      countsEl.innerHTML = `${usernameMatch}· <span title="Followers">${freshStats.followers_count} followers</span> · <span title="Following">${freshStats.following_count} following</span>`;
    }
  } catch (err) {
    showToast(err.message || "Couldn't update follow status.", "error");
  } finally {
    btn.disabled = false;
  }
}