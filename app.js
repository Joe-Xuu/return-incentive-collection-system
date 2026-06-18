/* ============================================================
   Re:Turn Dashboard — App Logic
   ============================================================ */

// --- Configuration ---------------------------------------
const LIFF_ID = "2008626930-pLAvndnp";
const GAS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbybohIvFuZ7GZC7KVckrjb4mn1SFFT1wG-Z1Anabt02il3N05NweJNgsctcFedsi6QY/exec";

// --- DOM References --------------------------------------
const $ = (sel) => document.querySelector(sel);

const loadingOverlay = $("#loading-overlay");
const appShell = $("#app");

const profilePic = $("#profile-pic");
const userName = $("#user-name");
const userIdEl = $("#user-id");
const statScore = $("#stat-score");
const statUsage = $("#stat-usage");
const borrowContent = $("#borrow-content");

// --- Helpers ---------------------------------------------

function formatTime(raw) {
  if (!raw) return "—";
  try {
    const d = new Date(raw.replace(" ", "T"));
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
}

function finishLoading() {
  loadingOverlay.classList.add("hidden");
  appShell.classList.remove("hidden");
}

/** Write error text directly into the borrow card so it's impossible to miss */
function showErrorInCard(msg) {
  borrowContent.innerHTML = `
    <div style="
      background:#fff5f5; border:2px solid #e53e3e; border-radius:14px;
      padding:18px 16px; color:#c53030; font-weight:600; font-size:0.9rem;
      word-break:break-all; line-height:1.6;
    ">
      ❌ ${escapeHtml(msg)}
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// --- Data Fetching ---------------------------------------

async function fetchDashboardData(userId, userName) {
  const res = await fetch(GAS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getDashboard",
      userId: userId,
      userName: userName || "ECO PLAYER",
    }),
  });

  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      "GAS did not return JSON. HTTP " + res.status + ". Response: " + text.slice(0, 200)
    );
  }

  if (!res.ok || json.status !== "success") {
    throw new Error(json.message || "HTTP " + res.status + " — " + JSON.stringify(json).slice(0, 200));
  }

  return json;
}

// --- Rendering -------------------------------------------

function renderProfile(data, liffProfile) {
  const picUrl =
    (liffProfile && liffProfile.pictureUrl) ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      data.userName
    )}&background=06c755&color=fff&size=128`;

  profilePic.src = picUrl;
  profilePic.onerror = () => {
    profilePic.src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23d4fcdc'/%3E%3Ctext x='50' y='65' text-anchor='middle' font-size='40' fill='%2306c755'%3E%E2%98%BB%3C/text%3E%3C/svg%3E";
  };

  userName.textContent = data.userName;
  statScore.textContent = data.score.toLocaleString();
  statUsage.textContent = data.usageCount;
}

function renderBorrowing(items) {
  if (!items || items.length === 0) {
    borrowContent.innerHTML = `
      <div class="borrow-empty">
        <div class="borrow-empty-icon">✅</div>
        <p class="borrow-empty-text">
          All cleared! You have no unreturned containers.
        </p>
      </div>`;
    return;
  }

  const listHtml = items
    .map(
      (item) => `
    <div class="borrow-item">
      <div class="borrow-item-left">
        <span class="borrow-container-id">${escapeHtml(item.containerId)}</span>
        <span class="borrow-time">${formatTime(item.borrowTime)}</span>
      </div>
      <span class="borrow-badge">Borrowing</span>
    </div>`
    )
    .join("");

  borrowContent.innerHTML = `<div class="borrow-list">${listHtml}</div>`;
}

// --- Init Flow -------------------------------------------

async function initApp() {
  // Step 1 — LIFF init
  await liff.init({ liffId: LIFF_ID });

  // Step 2 — get profile
  const liffProfile = await liff.getProfile();
  const userId = liffProfile.userId;
  const displayName = liffProfile.displayName || "";
  userIdEl.textContent = `ID: ${userId.slice(0, 12)}…`;

  // Step 3 — fetch from GAS (no mock, no fallback)
  const response = await fetchDashboardData(userId, displayName);

  // Step 4 — render
  renderProfile(response.data, liffProfile);
  renderBorrowing(response.data.borrowedItems);
  finishLoading();
}

// --- Boot ------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initApp().catch((err) => {
    // Any uncaught error → show in card + unhide shell
    console.error("[Re:Turn]", err.message || err);
    finishLoading();
    showErrorInCard(err.message || String(err));
  });
});
