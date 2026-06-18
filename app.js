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
 * Sends `action: "getDashboard"` to the GAS doPost router.
 * Races the real GAS endpoint against a mock-data timeout
 * so the UI still works if GAS isn't deployed yet.
 */
async function fetchDashboardData(userId, userName) {
  const MOCK_DELAY = 1800;

  const gasPromise = fetch(GAS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getDashboard",
      userId: userId,
      userName: userName || "ECO PLAYER",
    }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`GAS responded with ${res.status}`);
      const json = await res.json();
      if (json.status !== "success") {
        throw new Error(json.message || "GAS returned non-success");
      }
      console.log("[Re:Turn] ✓ Data from GAS endpoint");
      return json;
    });

  const mockPromise = new Promise((resolve) => {
    setTimeout(() => {
      console.log("[Re:Turn] ⚠ GAS not ready — using mock data");
      resolve(MOCK_RESPONSE);
    }, MOCK_DELAY);
  });

  return Promise.race([gasPromise, mockPromise]);
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

// --- Demo mode (LIFF unavailable) ------------------------

function runDemoMode() {
  console.log("[Re:Turn] Running in demo mode");
  const data = MOCK_RESPONSE.data;
  renderProfile(data, null);
  renderBorrowing(data.borrowedItems);
  userIdEl.textContent = "ID: demo-mode";
  finishLoading();
  showToast("Demo mode — not inside LINE.");
}

// --- Init Flow -------------------------------------------

async function initApp() {
  try {
    // 1. Initialize LIFF
    await liff.init({ liffId: LIFF_ID });
    console.log("[Re:Turn] LIFF initialized ✓");

    // 2. Get LIFF profile
    const liffProfile = await liff.getProfile();
    const userId = liffProfile.userId;
    const displayName = liffProfile.displayName || "";
    console.log("[Re:Turn] userId:", userId);
    userIdEl.textContent = `ID: ${userId.slice(0, 12)}…`;

    // 3. Fetch dashboard data (GAS or mock fallback)
    const response = await fetchDashboardData(userId, displayName);
    const data = response.data;

    // 4. Render
    renderProfile(data, liffProfile);
    renderBorrowing(data.borrowedItems);

    // 5. Reveal
    finishLoading();
  } catch (err) {
    // LIFF init failed — always fall back to demo mode
    console.warn("[Re:Turn] LIFF init failed:", err.message || err);
    runDemoMode();
  }
}

// --- Boot ------------------------------------------------
document.addEventListener("DOMContentLoaded", initApp);
