/* ==========================================================================
   KINDRED — Shared Utilities
   Avatar generation, toasts, theme, formatting, small DOM helpers
   ========================================================================== */

/* ---------- Default initials avatar ----------
   Generates a data-URL PNG avatar from a person's name so an image box
   is NEVER left broken or empty anywhere in the app. */
const AVATAR_PALETTE = [
  ["#E8B454", "#f0c876"],
  ["#E8607A", "#f28fa2"],
  ["#4FC1B0", "#7fd9cc"],
  ["#8C7CE8", "#b3a8f0"],
  ["#5FA8E8", "#8fc4f0"],
  ["#E88C54", "#f0ac7f"],
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(nameOrUsername) {
  if (!nameOrUsername) return "?";
  const parts = nameOrUsername.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Returns a data URL PNG with the person's initials on a gradient
 * derived deterministically from their name/username.
 */
function generateDefaultAvatar(nameOrUsername, size = 200) {
  const initials = getInitials(nameOrUsername || "Kindred User");
  const palette = AVATAR_PALETTE[hashString(nameOrUsername || "kindred") % AVATAR_PALETTE.length];

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, palette[0]);
  grad.addColorStop(1, palette[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.font = `700 ${size * 0.42}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials, size / 2 + 1, size / 2 + size * 0.04 + 1);

  ctx.fillStyle = "#ffffff";
  ctx.fillText(initials, size / 2, size / 2 + size * 0.04);

  return canvas.toDataURL("image/png");
}

/** Resolve the correct avatar src for a profile object: uploaded/URL pic, else generated default. */
function resolveAvatar(profile) {
  if (profile && profile.avatar_url) return profile.avatar_url;
  const label = (profile && (profile.full_name || profile.username)) || "Kindred User";
  return generateDefaultAvatar(label);
}

function resolveCover(profile) {
  if (profile && profile.cover_url) return profile.cover_url;
  // Curated Unsplash fallback covers, chosen deterministically per user
  const covers = [
    "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1200&q=80",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80",
    "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80",
    "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1200&q=80",
  ];
  const key = (profile && (profile.username || profile.full_name)) || "kindred";
  return covers[hashString(key) % covers.length];
}

/* ---------- Toasts ---------- */
function ensureToastStack() {
  let stack = document.querySelector(".k-toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "k-toast-stack";
    document.body.appendChild(stack);
  }
  return stack;
}

function showToast(message, type = "info", duration = 3800) {
  const stack = ensureToastStack();
  const icons = { success: "bi-check-circle-fill", error: "bi-exclamation-circle-fill", info: "bi-info-circle-fill" };
  const toast = document.createElement("div");
  toast.className = `k-toast ${type}`;
  toast.innerHTML = `<i class="bi ${icons[type] || icons.info}"></i><span>${message}</span>`;
  stack.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = "opacity 200ms ease, transform 200ms ease";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(24px)";
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

/* ---------- Theme ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("kindred-theme", theme);
  document.querySelectorAll("[data-theme-btn]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.themeBtn === theme);
  });
}

function initTheme() {
  const saved = localStorage.getItem("kindred-theme") || "dark";
  applyTheme(saved);
}

/* ---------- Formatting ---------- */
function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

/* ---------- Small DOM helpers ---------- */
function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function setFieldError(inputEl, errorEl, message) {
  if (message) {
    inputEl.classList.add("is-invalid");
    errorEl.textContent = message;
    errorEl.classList.add("show");
  } else {
    inputEl.classList.remove("is-invalid");
    errorEl.classList.remove("show");
  }
}

function setButtonLoading(btn, loading, loadingText = "Please wait...") {
  if (loading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> ${loadingText}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
  }
}

/** Reads a File and returns a base64 data URL (used for local previews / URL-less uploads) */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

initTheme();
