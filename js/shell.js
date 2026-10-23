/* ==========================================================================
   KINDRED — App Shell (sidebar + topbar + mobile nav)
   Shared across all authenticated pages so nav + default avatar behave
   identically everywhere.
   ========================================================================== */

const NAV_ITEMS = [
  { href: "dashboard.html", icon: "bi-person-circle", label: "Dashboard" },
  { href: "homefeed.html", icon: "bi-house-door-fill", label: "Home Feed" },
  { href: "search.html", icon: "bi-search", label: "Search" },
  { href: "explorer.html", icon: "bi-compass", label: "Explorer" },
  { href: "settings.html", icon: "bi-gear-fill", label: "Settings" },
];
const NAV_ICONS_MOBILE = ["bi-person-circle", "bi-house-door-fill", "bi-search", "bi-compass", "bi-gear-fill"];

async function renderAppShell(activePage) {
  const sidebarLinks = NAV_ITEMS.map(
    (item) => `<a href="${item.href}" class="k-nav-link ${item.href === activePage ? "active" : ""}">
        <i class="bi ${item.icon}"></i> ${item.label}
      </a>`
  ).join("");

  const sidebarHtml = `
    <aside class="k-sidebar" id="kSidebar">
      <div class="k-logo mb-4"><span class="k-mark">K</span>Kindred</div>
      <nav class="flex-grow-1">${sidebarLinks}</nav>
      <div class="k-theme-toggle mb-3">
        <button data-theme-btn="dark"><i class="bi bi-moon-stars-fill"></i></button>
        <button data-theme-btn="light"><i class="bi bi-sun-fill"></i></button>
      </div>
      <a href="#" id="shellCreatePostBtn" class="btn-k btn-k-primary w-100 mb-3"><i class="bi bi-plus-lg"></i> Create Post</a>
      <div class="d-flex align-items-center gap-2 p-2 rounded-4" style="background:var(--surface-hover);">
        <img id="shellAvatar" class="k-avatar" width="38" height="38" alt="Your avatar">
        <div class="flex-grow-1 overflow-hidden">
          <div id="shellName" class="fw-semibold small text-truncate">Loading...</div>
          <div id="shellUsername" class="text-muted small text-truncate">@...</div>
        </div>
        <button id="shellLogoutBtn" class="btn btn-sm btn-icon" title="Log out" style="background:none;border:none;color:var(--text-muted);">
          <i class="bi bi-box-arrow-right"></i>
        </button>
      </div>
    </aside>

    <nav class="k-mobile-bar">
      ${NAV_ITEMS.map((item, i) => `<a href="${item.href}" class="${item.href === activePage ? "active" : ""}"><i class="bi ${NAV_ICONS_MOBILE[i]}"></i></a>`).join("")}
    </nav>
  `;

  document.getElementById("shellMount").insertAdjacentHTML("beforebegin", sidebarHtml);

  // Mobile topbar toggle (each page provides a button with #kMenuToggle if desired)
  const menuToggle = document.getElementById("kMenuToggle");
  if (menuToggle) {
    menuToggle.addEventListener("click", () => document.getElementById("kSidebar").classList.toggle("open"));
  }

  qsa("[data-theme-btn]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.themeBtn === (localStorage.getItem("kindred-theme") || "dark"));
    btn.addEventListener("click", () => applyTheme(btn.dataset.themeBtn));
  });

  qs("#shellLogoutBtn").addEventListener("click", async () => {
    await signOut();
  });

  qs("#shellCreatePostBtn").addEventListener("click", (e) => {
    e.preventDefault();
    if (typeof openCreatePostModal === "function") openCreatePostModal();
    else window.location.href = "homefeed.html";
  });

  const profile = await getMyProfile();
  if (profile) {
    qs("#shellAvatar").src = resolveAvatar(profile);
    qs("#shellName").textContent = `${profile.first_name} ${profile.last_name}`.trim();
    qs("#shellUsername").textContent = `@${profile.username}`;
  }
  return profile;
}
