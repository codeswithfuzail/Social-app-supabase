/* ==========================================================================
   KINDRED — Explorer Page Logic
   ========================================================================== */

let __exploreTab = "recent";

document.addEventListener("DOMContentLoaded", async () => {
  await guardRoute();
  const profile = await renderAppShell("explorer.html");
  if (profile) qs("#topbarAvatar").src = resolveAvatar(profile);
  await ensureCurrentUser();

  qsa("[data-explore-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      qsa("[data-explore-tab]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      __exploreTab = btn.dataset.exploreTab;
      renderExploreGrid();
    });
  });

  attachPostActionHandlers(qs("#exploreGrid"), loadExplore);

  await loadSuggestedUsers();
  await loadExplore();
});

let __exploreCache = [];

async function loadExplore() {
  const grid = qs("#exploreGrid");
  grid.innerHTML = Array.from({ length: 6 }).map(() => `<div class="k-skel" style="height:${180 + Math.round(Math.random() * 140)}px;"></div>`).join("");
  try {
    const posts = await fetchPosts({ limit: 60 });
    __exploreCache = posts.filter((p) => p.image_url || p.video_url);
    renderExploreGrid();
  } catch (err) {
    grid.innerHTML = `<div class="k-empty">Couldn't load explore content.</div>`;
  }
}

function renderExploreGrid() {
  const grid = qs("#exploreGrid");
  let posts = [...__exploreCache];
  if (__exploreTab === "popular") posts.sort((a, b) => b.like_count - a.like_count);

  if (!posts.length) {
    grid.innerHTML = `<div class="k-empty"><div class="k-empty-icon"><i class="bi bi-camera"></i></div><h5>No media posts yet</h5><p class="mb-0">Photo and video posts will show up here as people share them.</p></div>`;
    return;
  }
  grid.innerHTML = posts.map(exploreCardHtml).join("");
}

function exploreCardHtml(post) {
  const author = post.profiles || {};
  const media = post.video_url
    ? `<video class="k-explore-media" src="${post.video_url}" muted loop playsinline onmouseover="this.play()" onmouseout="this.pause()"></video>`
    : `<img class="k-explore-media" src="${post.image_url}" alt="" loading="lazy">`;

  return `
  <div class="k-card k-explore-card" data-post-id="${post.id}">
    <div style="position:relative;">
      ${media}
      ${post.video_url ? `<span class="position-absolute top-0 end-0 m-2 badge" style="background:rgba(0,0,0,.55);"><i class="bi bi-play-fill"></i></span>` : ""}
      <div class="k-explore-overlay">
        <div class="k-explore-actions">
          <button class="k-like-btn ${post.liked_by_me ? "liked" : ""}" data-id="${post.id}"><i class="bi ${post.liked_by_me ? "bi-heart-fill" : "bi-heart"}"></i><span class="k-like-count">${post.like_count}</span></button>
          <button class="k-comment-toggle" data-id="${post.id}"><i class="bi bi-chat"></i><span class="k-comment-count">${post.comment_count}</span></button>
          <button class="k-share-btn" data-id="${post.id}"><i class="bi bi-share"></i></button>
        </div>
      </div>
    </div>
    <div class="k-explore-caption">
      <img src="${resolveAvatar(author)}" class="k-avatar me-1" width="20" height="20" alt="">
      <strong>@${escapeHtml(author.username || "user")}</strong>
      ${post.content ? `<span class="text-muted"> · ${escapeHtml(post.content).slice(0, 80)}</span>` : ""}
      <div class="k-comments-pane mt-2" id="comments-${post.id}" style="display:none;">
        <div class="k-comments-list mb-2 d-flex flex-column gap-2"></div>
        <form class="d-flex gap-2 k-comment-form" data-id="${post.id}">
          <input class="k-input" placeholder="Write a comment...">
          <button class="btn-k btn-k-ghost" type="submit"><i class="bi bi-send"></i></button>
        </form>
      </div>
    </div>
  </div>`;
}

async function loadSuggestedUsers() {
  const row = qs("#suggestedUsersRow");
  const { data: { user } } = await supabaseClient.auth.getUser();
  const { data: users } = await supabaseClient
    .from("profiles")
    .select("*")
    .neq("id", user?.id || "00000000-0000-0000-0000-000000000000")
    .limit(8);

  if (!users || !users.length) { row.innerHTML = ""; return; }

  row.innerHTML = users.map((u) => `
    <a href="dashboard.html?user=${u.id}" class="k-card k-suggested-card hoverable">
      <img src="${resolveAvatar(u)}" class="k-avatar mb-2" width="56" height="56" alt="">
      <div class="fw-semibold small text-truncate">${escapeHtml(u.first_name)} ${escapeHtml(u.last_name)}</div>
      <div class="text-muted small text-truncate">@${escapeHtml(u.username)}</div>
    </a>`).join("");
}
