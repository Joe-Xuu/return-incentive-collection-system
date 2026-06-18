/* ============================================================
   Re:Turn Dashboard — App Logic
   ============================================================ */

// --- Configuration ---------------------------------------
const LIFF_ID = "2008626930-pLAvndnp";
const GAS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbybohIvFuZ7GZC7KVckrjb4mn1SFFT1wG-Z1Anabt02il3N05NweJNgsctcFedsi6QY/exec";

// --- Mock Data -------------------------------------------
const MOCK_RESPONSE = {
  status: "success",
  data: {
    userName: "Joe Xuu",
    score: 1250,
    usageCount: 15,
    borrowedItems: [
      { containerId: "C-012", borrowTime: "2026-06-18 10:30:00" },
    ],
  },
};

// --- DOM References --------------------------------------
const $ = (sel) => document.querySelector(sel);

const loadingOverlay = $("#loading-overlay");
const appShell = $("#app");
const errorToast = $("#error-toast");
const errorMessage = $("#error-message");

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

function showToast(msg) {
  errorMessage.textContent = msg;
  errorToast.classList.remove("hidden");
}

// Dismiss toast on tap
errorToast.addEventListener("click", () => {
  errorToast.classList.add("hidden");
});

function finishLoading() {
  loadingOverlay.classList.add("hidden");
  appShell.classList.remove("hidden");
}

// --- Data Fetching ---------------------------------------

/**
 * Fetch dashboard data for a given userId.
 * Tries GAS first; falls back to mock data immediately on any failure.
 */
async function fetchDashboardData(userId, userName) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(GAS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "getDashboard",
        userId: userId,
        userName: userName || "ECO PLAYER",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // Even on HTTP errors, try to read the body for a useful error message
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(
        `GAS returned non-JSON (HTTP ${res.status}): ${text.slice(0, 120)}`
      );
    }

    if (!res.ok || json.status !== "success") {
      throw new Error(json.message || `HTTP ${res.status}`);
    }

    console.log("[Re:Turn] ✓ Data from GAS endpoint");
    return json;
  } catch (err) {
    clearTimeout(timeout);
    console.warn("[Re:Turn] GAS failed, using mock:", err.message);
    showToast("GAS: " + (err.message || err));
    return MOCK_RESPONSE;
  }
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
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23d4fcdc'/%3E%3Ctext x='50' y='65' text-anchor='middle' font-size='40' fill='%2306c755'%3E👤%3C/text%3E%3C/svg%3E";
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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// --- Render mock fallback (GAS unreachable) ---------------

function renderWithMockData() {
  const data = MOCK_RESPONSE.data;
  renderProfile(data, null);
  renderBorrowing(data.borrowedItems);
  userIdEl.textContent = "ID: —";
  finishLoading();
}

// --- Init Flow -------------------------------------------

async function initApp() {
  let liffProfile = null;
  let userId = null;
  let displayName = "";

  // Step 1 — LIFF init
  try {
    await liff.init({ liffId: LIFF_ID });
    console.log("[Re:Turn] LIFF initialized ✓");
  } catch (err) {
    console.warn("[Re:Turn] LIFF init failed:", err.message || err);
    renderWithMockData();
    showToast("LIFF init failed. Are you inside LINE?");
    return;
  }

  // Step 2 — get LIFF profile
  try {
    liffProfile = await liff.getProfile();
    userId = liffProfile.userId;
    displayName = liffProfile.displayName || "";
    console.log("[Re:Turn] userId:", userId);
    userIdEl.textContent = `ID: ${userId.slice(0, 12)}…`;
  } catch (err) {
    console.warn("[Re:Turn] getProfile failed:", err.message || err);
    renderWithMockData();
    showToast("Profile error: " + (err.message || err));
    return;
  }

  // Step 3 — fetch dashboard (GAS or mock)
  let response;
  try {
    response = await fetchDashboardData(userId, displayName);
  } catch (err) {
    console.warn("[Re:Turn] fetchDashboardData threw:", err.message || err);
    renderWithMockData();
    showToast("Data error: " + (err.message || err));
    return;
  }

  // Step 4 — render
  try {
    const data = response.data;
    renderProfile(data, liffProfile);
    renderBorrowing(data.borrowedItems);
    finishLoading();
  } catch (err) {
    console.warn("[Re:Turn] Render failed:", err.message || err);
    renderWithMockData();
    showToast("Render error: " + (err.message || err));
  }
}

// --- Boot ------------------------------------------------
document.addEventListener("DOMContentLoaded", initApp);
