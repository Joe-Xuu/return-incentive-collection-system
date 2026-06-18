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
const userNameEl = $("#user-name");
const userIdEl = $("#user-id");
const statScore = $("#stat-score");
const statUsage = $("#stat-usage");
const borrowContent = $("#borrow-content");
const historyContent = $("#history-content");

// --- Helpers ---------------------------------------------

function formatTime(raw) {
  if (!raw) return "—";
  try {
    const d = new Date(raw.replace(" ", "T"));
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return raw; }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function finishLoading() {
  loadingOverlay.classList.add("hidden");
  appShell.classList.remove("hidden");
}

// --- Data Fetching ---------------------------------------

async function fetchDashboardData(userId, userName) {
  const url = GAS_ENDPOINT + "?" + new URLSearchParams({
    action: "getDashboard",
    userId: userId,
    userName: userName || "ECO PLAYER",
  }).toString();

  const res = await fetch(url);
  const text = await res.text();
  const json = JSON.parse(text);

  if (!res.ok || json.status !== "success") {
    throw new Error(json.message || "HTTP " + res.status);
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

  userNameEl.textContent = data.userName;
  statScore.textContent = data.score.toLocaleString();
  statUsage.textContent = data.usageCount;
}

function renderBorrowing(items) {
  if (!items || items.length === 0) {
    borrowContent.innerHTML = `
      <div class="borrow-empty">
        <div class="borrow-empty-icon">✅</div>
        <p class="borrow-empty-text">All cleared! You have no unreturned containers.</p>
      </div>`;
    return;
  }

  const listHtml = items.map((item) => `
    <div class="borrow-item">
      <div class="borrow-item-left">
        <span class="borrow-container-id">${escapeHtml(item.containerId)}</span>
        <span class="borrow-time">Borrowed: ${formatTime(item.borrowTime)}</span>
      </div>
      <span class="borrow-badge">Borrowing</span>
    </div>`).join("");

  borrowContent.innerHTML = `<div class="borrow-list">${listHtml}</div>`;
}

function renderHistory(transactions) {
  if (!transactions || transactions.length === 0) {
    historyContent.innerHTML = `<div class="history-empty">No transactions yet.</div>`;
    return;
  }

  const listHtml = transactions.map((tx) => {
    let badgeHtml = "";
    let warnHtml = "";

    if (tx.status === "BORROWED") {
      badgeHtml = `<span class="history-badge badge-borrowed">Borrowing</span>`;
    } else if (tx.status === "RETURNED") {
      badgeHtml = `<span class="history-badge badge-returned">Returned</span>`;
    } else if (tx.status === "ERROR_CLOSED" || tx.status === "ERROR_RETURN") {
      badgeHtml = `<span class="history-badge badge-error">NFC Miss</span>`;
      warnHtml = `<div class="history-nfc-warn">⚠ The NFC scan may have failed. Please hold the container longer next time.</div>`;
    } else {
      badgeHtml = `<span class="history-badge badge-returned">${escapeHtml(tx.status)}</span>`;
    }

    const timeInfo = tx.returnTime
      ? `Borrowed: ${formatTime(tx.borrowTime)}  ·  Returned: ${formatTime(tx.returnTime)}`
      : `Borrowed: ${formatTime(tx.borrowTime)}`;

    return `
    <div class="history-item">
      <div class="history-item-left">
        <span class="history-container-id">${escapeHtml(tx.containerId)}</span>
        <span class="history-time">${timeInfo}</span>
        ${warnHtml}
      </div>
      ${badgeHtml}
    </div>`;
  }).join("");

  historyContent.innerHTML = `<div class="history-list">${listHtml}</div>`;
}

// --- Init Flow -------------------------------------------

async function initApp() {
  await liff.init({ liffId: LIFF_ID });

  const liffProfile = await liff.getProfile();
  const userId = liffProfile.userId;
  const displayName = liffProfile.displayName || "";
  userIdEl.textContent = `ID: ${userId.slice(0, 12)}…`;

  const response = await fetchDashboardData(userId, displayName);
  const data = response.data;

  renderProfile(data, liffProfile);
  renderBorrowing(data.borrowedItems);
  renderHistory(data.recentTransactions);
  finishLoading();
}

// --- Boot ------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initApp().catch((err) => {
    console.error("[Re:Turn]", err.message || err);
    finishLoading();
    borrowContent.innerHTML = `
      <div class="borrow-empty">
        <p class="borrow-empty-text">Failed to load. Please try again.</p>
      </div>`;
  });
});
