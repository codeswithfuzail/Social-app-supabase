/* ==========================================================================
   KINDRED — Home Feed Page Logic
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  await guardRoute();
  const profile = await renderAppShell("homefeed.html");
  await ensureCurrentUser();

  if (profile) {
    qs("#topbarAvatar").src = resolveAvatar(profile);
    qs("#composerAvatar").src = resolveAvatar(profile);
  }

  wireCreatePostForm(loadFeed);
  attachPostActionHandlers(qs("#feedList"), loadFeed);

  await loadFeed();
});

async function loadFeed() {
  const list = qs("#feedList");
  list.innerHTML = `<div class="k-skel mb-3" style="height:160px;"></div><div class="k-skel mb-3" style="height:160px;"></div>`;
  try {
    const posts = await fetchPosts({ limit: 40 });
    renderPostsInto(list, posts, "Follow people or create your first post to get your feed going.");
  } catch (err) {
    list.innerHTML = `<div class="k-empty">Couldn't load the feed.</div>`;
  }
}
