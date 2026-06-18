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

// --- Step-by-step progress log (shown in borrow card) ----

let steps = [];

function addStep(label, ok, detail) {
  steps.push({ label, ok, detail });
  const html = steps.map(s => {
    const icon = s.ok === true ? "✅" : s.ok === false ? "❌" : "⏳";
    const color = s.ok === true ? "#06C755" : s.ok === false ? "#e53e3e" : "#999";
    const detailHtml = s.detail ? `<div style="font-size:0.75rem;color:#888;margin-top:2px;">${escapeHtml(s.detail)}</div>` : "";
    return `<div style="padding:6px 0;color:${color};font-weight:600;font-size:0.9rem;">${icon} ${escapeHtml(s.label)}${detailHtml}</div>`;
  }).join("");
  borrowContent.innerHTML = `<div style="padding:4px 0;">${html}</div>`;
}

// --- Data Fetching ---------------------------------------

async function fetchDashboardData(userId, userName) {
  const url = GAS_ENDPOINT + "?" + new URLSearchParams({
    action: "getDashboard",
    userId: userId,
    userName: userName || "ECO PLAYER",
  }).toString();

  addStep("Fetching " + url.slice(0, 70) + "…", null);

  let res;
  try {
    res = await fetch(url);
    addStep("HTTP response: " + res.status + " " + res.statusText, res.ok);
  } catch (err) {
    addStep("Fetch failed", false, err.message || String(err));
    throw err;
  }

  const text = await res.text();
  addStep("Response body (" + text.length + " bytes)", true, text.slice(0, 300));

  let json;
  try {
    json = JSON.parse(text);
    addStep("JSON parsed", true, JSON.stringify(json).slice(0, 300));
  } catch {
    addStep("JSON parse failed", false, "Not valid JSON. Raw: " + text.slice(0, 300));
    throw new Error("GAS returned non-JSON (HTTP " + res.status + ")");
  }

  if (!res.ok || json.status !== "success") {
    addStep("GAS status check", false, "status=" + json.status + " message=" + (json.message || "none"));
    throw new Error(json.message || "HTTP " + res.status);
  }

  addStep("GAS returned success", true, "userName=" + json.data.userName + " score=" + json.data.score + " items=" + json.data.borrowedItems.length);
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
        <p class="borrow-empty-text">All cleared! You have no unreturned containers.</p>
      </div>`;
    return;
  }

  const listHtml = items.map((item) => `
    <div class="borrow-item">
      <div class="borrow-item-left">
        <span class="borrow-container-id">${escapeHtml(item.containerId)}</span>
        <span class="borrow-time">${formatTime(item.borrowTime)}</span>
      </div>
      <span class="borrow-badge">Borrowing</span>
    </div>`).join("");

  borrowContent.innerHTML = `<div class="borrow-list">${listHtml}</div>`;
}

// --- Init Flow -------------------------------------------

async function initApp() {
  // Step 1 — LIFF init
  addStep("LIFF init…", null);
  try {
    await liff.init({ liffId: LIFF_ID });
    addStep("LIFF init", true);
  } catch (err) {
    addStep("LIFF init", false, err.message || String(err));
    throw err;
  }

  // Step 2 — get profile
  addStep("getProfile()…", null);
  let liffProfile, userId, displayName;
  try {
    liffProfile = await liff.getProfile();
    userId = liffProfile.userId;
    displayName = liffProfile.displayName || "";
    addStep("getProfile()", true, "userId=" + userId.slice(0, 16) + "… displayName=" + displayName);
    userIdEl.textContent = `ID: ${userId.slice(0, 12)}…`;
  } catch (err) {
    addStep("getProfile()", false, err.message || String(err));
    throw err;
  }

  // Step 3 — GAS fetch
  const response = await fetchDashboardData(userId, displayName);

  // Step 4 — render
  addStep("Rendering…", null);
  renderProfile(response.data, liffProfile);
  renderBorrowing(response.data.borrowedItems);
  addStep("Render complete", true);

  finishLoading();
}

// --- Boot ------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initApp().catch(() => {
    // Error already logged by addStep — just unhide shell
    finishLoading();
  });
});
