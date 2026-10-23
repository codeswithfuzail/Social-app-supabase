/* ==========================================================================
   KINDRED — Posts Module
   Shared by dashboard.js, homefeed.js, explorer.js
   ========================================================================== */

let __kindredCurrentUserId = null;
let __kindredMyProfile = null;

async function ensureCurrentUser() {
  if (!__kindredCurrentUserId) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    __kindredCurrentUserId = user?.id || null;
    __kindredMyProfile = await getMyProfile();
  }
  return __kindredCurrentUserId;
}

/** Opens the shared Create Post modal (present on dashboard.html and homefeed.html). */
function openCreatePostModal() {
  const modalEl = document.getElementById("createPostModal");
  if (!modalEl) return;
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function setMediaTab(tab) {
  qsa("[data-media-tab]").forEach((b) => b.classList.toggle("active", b.dataset.mediaTab === tab));
  qs("#mediaPaneImage").style.display = tab === "image" ? "block" : "none";
  qs("#mediaPaneVideo").style.display = tab === "video" ? "block" : "none";
}

/** Wires the shared #createPostForm (works on any page that includes the modal markup). */
function wireCreatePostForm(onCreated) {
  const form = qs("#createPostForm");
  if (!form) return;

  qsa("[data-media-tab]").forEach((btn) => btn.addEventListener("click", () => setMediaTab(btn.dataset.mediaTab)));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = qs("#createPostBtn");
    const content = qs("#postContent").value.trim();
    const imageUrl = qs("#postImageUrl")?.value.trim();
    const imageFile = qs("#postImageFile")?.files[0];
    const videoFile = qs("#postVideoFile")?.files[0];

    if (!content && !imageUrl && !imageFile && !videoFile) {
      showToast("Write something or attach media to post.", "error");
      return;
    }

    setButtonLoading(btn, true, "Posting...");
    try {
      const userId = await ensureCurrentUser();
      let image_url = imageUrl || null;
      let video_url = null;

      if (imageFile) image_url = await uploadToBucket(STORAGE_BUCKETS.posts, imageFile, userId);
      if (videoFile) video_url = await uploadToBucket(STORAGE_BUCKETS.posts, videoFile, userId);

      const { error } = await supabaseClient.from("posts").insert({
        user_id: userId,
        content,
        image_url,
        video_url,
      });
      if (error) throw error;

      showToast("Post published!", "success");
      form.reset();
      setMediaTab("none");
      bootstrap.Modal.getInstance(qs("#createPostModal"))?.hide();
      if (onCreated) onCreated();
    } catch (err) {
      showToast(err.message || "Couldn't publish your post.", "error");
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

/** Fetches posts (optionally filtered to one user), joined with author profile + like/comment counts + whether I liked it. */
async function fetchPosts({ userId = null, limit = 30 } = {}) {
  await ensureCurrentUser();

  let query = supabaseClient
    .from("posts")
    .select("*, profiles:user_id(*)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (userId) query = query.eq("user_id", userId);

  const { data: posts, error } = await query;
  if (error) throw error;
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);
  const [{ data: likes }, { data: comments }] = await Promise.all([
    supabaseClient.from("likes").select("post_id, user_id").in("post_id", postIds),
    supabaseClient.from("comments").select("id, post_id").in("post_id", postIds),
  ]);

  return posts.map((p) => ({
    ...p,
    like_count: (likes || []).filter((l) => l.post_id === p.id).length,
    comment_count: (comments || []).filter((c) => c.post_id === p.id).length,
    liked_by_me: (likes || []).some((l) => l.post_id === p.id && l.user_id === __kindredCurrentUserId),
  }));
}

function postCardHtml(post) {
  const author = post.profiles || {};
  const avatar = resolveAvatar(author);
  const isMine = post.user_id === __kindredCurrentUserId;

  const mediaHtml = post.video_url
    ? `<video class="k-post-media" controls preload="metadata"><source src="${post.video_url}" type="video/mp4"></video>`
    : post.image_url
      ? `<img class="k-post-media" src="${post.image_url}" alt="Post image" loading="lazy">`
      : "";

  return `
  <article class="k-card k-post" data-post-id="${post.id}">
    <div class="d-flex align-items-start gap-2">
      <img src="${avatar}" class="k-avatar" width="44" height="44" alt="${escapeHtml(author.username || "")}">
      <div class="flex-grow-1 min-w-0">
        <div class="d-flex align-items-center justify-content-between">
          <div class="min-w-0">
            <span class="fw-semibold">${escapeHtml(author.first_name || "")} ${escapeHtml(author.last_name || "")}</span>
            <span class="text-muted small ms-1">@${escapeHtml(author.username || "unknown")} · ${timeAgo(post.created_at)}</span>
          </div>
          ${isMine ? `
          <div class="dropdown">
            <button class="btn btn-sm" data-bs-toggle="dropdown" style="background:none;border:none;color:var(--text-muted);"><i class="bi bi-three-dots"></i></button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><button class="dropdown-item k-edit-post" data-id="${post.id}"><i class="bi bi-pencil me-2"></i>Edit</button></li>
              <li><button class="dropdown-item text-danger k-delete-post" data-id="${post.id}"><i class="bi bi-trash me-2"></i>Delete</button></li>
            </ul>
          </div>` : ""}
        </div>
        ${post.content ? `<p class="mt-2 mb-2 k-post-content" data-id="${post.id}">${escapeHtml(post.content)}</p>` : ""}
      </div>
    </div>
    ${mediaHtml}
    <div class="k-post-actions">
      <button class="k-post-action k-like-btn ${post.liked_by_me ? "liked" : ""}" data-id="${post.id}">
        <i class="bi ${post.liked_by_me ? "bi-heart-fill" : "bi-heart"}"></i> <span class="k-like-count">${post.like_count}</span>
      </button>
      <button class="k-post-action k-comment-toggle" data-id="${post.id}">
        <i class="bi bi-chat"></i> <span class="k-comment-count">${post.comment_count}</span>
      </button>
      <button class="k-post-action k-share-btn" data-id="${post.id}">
        <i class="bi bi-share"></i> Share
      </button>
    </div>
    <div class="k-comments-pane mt-3" id="comments-${post.id}" style="display:none;">
      <div class="k-comments-list mb-2 d-flex flex-column gap-2"></div>
      <form class="d-flex gap-2 k-comment-form" data-id="${post.id}">
        <input class="k-input" placeholder="Write a comment...">
        <button class="btn-k btn-k-ghost" type="submit"><i class="bi bi-send"></i></button>
      </form>
    </div>
  </article>`;
}

function renderPostsInto(container, posts, emptyMessage = "No posts yet.") {
  if (!posts.length) {
    container.innerHTML = `<div class="k-empty"><div class="k-empty-icon"><i class="bi bi-images"></i></div><h5>Nothing here yet</h5><p class="mb-0">${emptyMessage}</p></div>`;
    return;
  }
  container.innerHTML = posts.map(postCardHtml).join("");
}

/** Delegated click/submit handling for like, comment, share, edit, delete — call once per container. */
function attachPostActionHandlers(container, onChange) {
  container.addEventListener("click", async (e) => {
    const likeBtn = e.target.closest(".k-like-btn");
    if (likeBtn) return handleLikeToggle(likeBtn);

    const shareBtn = e.target.closest(".k-share-btn");
    if (shareBtn) return handleShare(shareBtn.dataset.id);

    const commentToggle = e.target.closest(".k-comment-toggle");
    if (commentToggle) return toggleComments(commentToggle.dataset.id);

    const deleteBtn = e.target.closest(".k-delete-post");
    if (deleteBtn) return handleDeletePost(deleteBtn.dataset.id, onChange);

    const editBtn = e.target.closest(".k-edit-post");
    if (editBtn) return handleEditPost(editBtn.dataset.id);
  });

  container.addEventListener("submit", async (e) => {
    const form = e.target.closest(".k-comment-form");
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector("input");
    const text = input.value.trim();
    if (!text) return;
    const postId = form.dataset.id;
    try {
      const userId = await ensureCurrentUser();
      const { error } = await supabaseClient.from("comments").insert({ post_id: postId, user_id: userId, content: text });
      if (error) throw error;
      input.value = "";
      await loadCommentsInto(postId);
      const countEl = container.querySelector(`.k-post[data-post-id="${postId}"] .k-comment-count`);
      if (countEl) countEl.textContent = parseInt(countEl.textContent, 10) + 1;
    } catch (err) {
      showToast(err.message || "Couldn't post comment.", "error");
    }
  });
}

async function handleLikeToggle(btn) {
  const postId = btn.dataset.id;
  const userId = await ensureCurrentUser();
  const isLiked = btn.classList.contains("liked");
  const countEl = btn.querySelector(".k-like-count");
  const icon = btn.querySelector("i");

  // optimistic UI
  btn.classList.toggle("liked", !isLiked);
  icon.className = !isLiked ? "bi bi-heart-fill" : "bi bi-heart";
  countEl.textContent = parseInt(countEl.textContent, 10) + (isLiked ? -1 : 1);

  try {
    if (isLiked) {
      await supabaseClient.from("likes").delete().eq("post_id", postId).eq("user_id", userId);
    } else {
      await supabaseClient.from("likes").insert({ post_id: postId, user_id: userId });
    }
  } catch (err) {
    // revert on failure
    btn.classList.toggle("liked", isLiked);
    icon.className = isLiked ? "bi bi-heart-fill" : "bi bi-heart";
    countEl.textContent = parseInt(countEl.textContent, 10) + (isLiked ? 1 : -1);
    showToast("Couldn't update like.", "error");
  }
}

async function handleShare(postId) {
  const url = `${window.location.origin}${window.location.pathname.replace(/[^/]+$/, "")}homefeed.html#post-${postId}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Check out this post on Kindred", url });
      return;
    } catch { /* user cancelled — fall through to clipboard */ }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast("Post link copied to clipboard!", "success");
  } catch {
    showToast(url, "info", 6000);
  }
}

async function toggleComments(postId) {
  const pane = document.getElementById(`comments-${postId}`);
  const isOpen = pane.style.display !== "none";
  pane.style.display = isOpen ? "none" : "block";
  if (!isOpen) await loadCommentsInto(postId);
}

async function loadCommentsInto(postId) {
  const list = document.querySelector(`#comments-${postId} .k-comments-list`);
  list.innerHTML = `<div class="k-skel" style="height:34px;"></div>`;
  const { data: comments, error } = await supabaseClient
    .from("comments")
    .select("*, profiles:user_id(*)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) { list.innerHTML = `<p class="text-muted small mb-0">Couldn't load comments.</p>`; return; }
  if (!comments.length) { list.innerHTML = `<p class="text-muted small mb-0">No comments yet — be the first.</p>`; return; }

  list.innerHTML = comments.map((c) => `
    <div class="d-flex gap-2 align-items-start">
      <img src="${resolveAvatar(c.profiles)}" class="k-avatar" width="30" height="30" alt="">
      <div class="k-card px-3 py-2 flex-grow-1" style="border-radius:14px;">
        <div class="small"><strong>${escapeHtml(c.profiles?.username || "user")}</strong> <span class="text-muted">${timeAgo(c.created_at)}</span></div>
        <div class="small">${escapeHtml(c.content)}</div>
      </div>
    </div>`).join("");
}

async function handleDeletePost(postId, onChange) {
  if (!confirm("Delete this post? This can't be undone.")) return;
  try {
    const { error } = await supabaseClient.from("posts").delete().eq("id", postId);
    if (error) throw error;
    showToast("Post deleted.", "success");
    if (onChange) onChange();
  } catch (err) {
    showToast(err.message || "Couldn't delete post.", "error");
  }
}

async function handleEditPost(postId) {
  const p = document.querySelector(`.k-post-content[data-id="${postId}"]`);
  const current = p ? p.textContent : "";
  const updated = prompt("Edit your post:", current);
  if (updated === null || updated.trim() === current.trim()) return;
  try {
    const { error } = await supabaseClient.from("posts").update({ content: updated.trim() }).eq("id", postId);
    if (error) throw error;
    if (p) p.textContent = updated.trim();
    showToast("Post updated.", "success");
  } catch (err) {
    showToast(err.message || "Couldn't update post.", "error");
  }
}
