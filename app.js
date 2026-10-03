/* ============================================================
   Re:Turn Dashboard — App Logic
   ============================================================ */

// --- Configuration ---------------------------------------
const LIFF_ID = "2008626930-pLAvndnp";
const GAS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbybohIvFuZ7GZC7KVckrjb4mn1SFFT1wG-Z1Anabt02il3N05NweJNgsctcFedsi6QY/exec";

const CO2_PER_USE = 36;   // g CO2 per use = 1 single-use paper container avoided (Megloo LCA, 36g/container)
const MEGLOO_LIFECYCLE = 100; // assumed full reuse cycles per container

// --- Module-level state ----------------------------------
let _currentUserId   = null;
let _currentUserName = null;

// --- DOM References --------------------------------------
const $ = (sel) => document.querySelector(sel);

const loadingOverlay = $("#loading-overlay");
const appShell       = $("#app");
const profilePic     = $("#profile-pic");
const userNameEl     = $("#user-name");
const userIdEl       = $("#user-id");
const statScore      = $("#stat-score");
const statUsage      = $("#stat-usage");
const statCo2        = $("#stat-co2");
const borrowContent  = $("#borrow-content");
const ecoValue       = $("#eco-value");
const ecoLabel       = $("#eco-label");
const ecoBar         = $("#eco-bar");
const ecoCaption     = $("#eco-caption");
const lbContent      = $("#leaderboard-content");
const headerLabel    = $("#header-tab-label");

// --- Tab Switching ---------------------------------------

const TAB_LABELS = {
  profile:     "Dashboard",
  leaderboard: "Ranking",
  map:         "Map",
};

function switchTab(name) {
  // hide all panels
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
  // deactivate all buttons
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));

  // show target panel
  $(`#tab-${name}`).classList.remove("hidden");
  // activate target button
  document.querySelector(`.tab-btn[data-tab="${name}"]`).classList.add("active");

  // update header label
  headerLabel.textContent = TAB_LABELS[name] || name;

  // lazy-load leaderboard on first visit
  if (name === "leaderboard") {
    loadLeaderboard();
  }
}

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

// --- Eco Impact ------------------------------------------
// Based on Megloo LCA data (supervised by Earth & Human Environment Forum / Univ. of Tokyo):
//   - Single-use paper container (36g) → 36g CO2/use
//   - Each Megloo use = 1 paper container avoided = 36g CO2 saved
//
// Piecewise CO2 metaphor tiers:
//   < 1,000g  → single-use containers avoided (1 container = 36g)
//   < 21,000g → plastic bags (~30g CO2 each)
//   >=21,000g → car-km (~210g CO2/km)

function computeEcoMetaphor(totalCo2g) {
  if (totalCo2g < 1000) {
    const containers = Math.round(totalCo2g / 36);
    return { icon: "◻", value: `≈ ${containers}`, label: "single-use containers worth of CO₂" };
  } else if (totalCo2g < 21000) {
    const bags = Math.round(totalCo2g / 30);
    return { icon: "◻", value: `≈ ${bags}`, label: "plastic bags worth of CO₂" };
  } else {
    const km = (totalCo2g / 210).toFixed(1);
    return { icon: "→", value: `≈ ${km} km`, label: "equivalent car journey avoided" };
  }
}

function renderEcoImpact(usageCount) {
  const totalCo2g = usageCount * CO2_PER_USE;

  // ── Stat box: CO2 saved ──
  const co2Str = totalCo2g >= 1000
    ? (totalCo2g / 1000).toFixed(2) + "kg"
    : totalCo2g + "g";
  if (statCo2) statCo2.textContent = co2Str;

  // ── CO2 metaphor ──
  const m = computeEcoMetaphor(totalCo2g);
  ecoValue.textContent = m.value;
  ecoLabel.textContent = m.label;

  // ── Lifecycle progress bar ──
  const cycleProgress = usageCount % MEGLOO_LIFECYCLE;
  const cycleNum      = Math.floor(usageCount / MEGLOO_LIFECYCLE);
  const pct           = (cycleProgress / MEGLOO_LIFECYCLE) * 100;
  setTimeout(() => { ecoBar.style.width = pct + "%"; }, 100);

  const cycleEl = document.getElementById("eco-cycle-label");
  if (cycleEl) {
    cycleEl.textContent = cycleNum > 0
      ? `Cycle ${cycleNum + 1} · ${cycleProgress}/${MEGLOO_LIFECYCLE} uses`
      : `${cycleProgress}/${MEGLOO_LIFECYCLE} uses`;
  }

  // ── Caption ──
  ecoCaption.textContent = "Megloo LCA data · 36g CO₂ per container";
}

// --- Data Fetching ---------------------------------------

async function fetchDashboardData(userId, userName) {
  const url = GAS_ENDPOINT + "?" + new URLSearchParams({
    action: "getDashboard",
    userId: userId,
    userName: userName || "ECO PLAYER",
  }).toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  const json = JSON.parse(text);

  if (!res.ok || json.status !== "success") {
    throw new Error(json.message || "HTTP " + res.status);
  }

  // Cache the result for next open
  try {
    localStorage.setItem(
      `return_dashboard_${userId}`,
      JSON.stringify({ data: json.data, cachedAt: Date.now() })
    );
  } catch (_) {}

  return json;
}

async function fetchLeaderboard() {
  const url = GAS_ENDPOINT + "?" + new URLSearchParams({ action: "getStats" }).toString();
  const res  = await fetch(url);
  const text = await res.text();
  return JSON.parse(text);
}

// --- Rendering -------------------------------------------

function renderProfile(data, liffProfile) {
  if (liffProfile) {
    const picUrl =
      liffProfile.pictureUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        data.userName
      )}&background=06c755&color=fff&size=128`;
    profilePic.src = picUrl;
    profilePic.onerror = () => {
      profilePic.src =
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23d4fcdc'/%3E%3Ctext x='50' y='65' text-anchor='middle' font-size='40' fill='%2306c755'%3E%E2%98%BB%3C/text%3E%3C/svg%3E";
    };
  }

  userNameEl.textContent = data.userName;
  const uses   = data.usageCount || 0;
  const points = uses * 10;
  statScore.textContent = points.toLocaleString();
  statUsage.textContent = uses;

  renderEcoImpact(uses);
}

function renderBorrowing(items) {
  if (!items || items.length === 0) {
    borrowContent.innerHTML = `
      <div class="borrow-empty">
        <div class="borrow-empty-icon">✓</div>
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

async function refreshBorrowing() {
  if (!_currentUserId) return;
  borrowContent.innerHTML = `<div class="borrow-empty"><p class="borrow-empty-text">Refreshing…</p></div>`;
  try {
    const response = await fetchDashboardData(_currentUserId, _currentUserName);
    renderProfile(response.data, null);
    renderBorrowing(response.data.borrowedItems);
  } catch (err) {
    const msg = err.name === "AbortError"
      ? "Server took too long. Try again."
      : "Failed to refresh. Try again.";
    borrowContent.innerHTML = `<div class="borrow-empty"><p class="borrow-empty-text">${msg}</p></div>`;
  }
}

async function loadLeaderboard() {
  lbContent.innerHTML = `<div class="lb-loading">Loading rankings…</div>`;
  try {
    const json = await fetchLeaderboard();
    if (json.status !== "success") throw new Error(json.message || "Failed");

    const board      = json.leaderboard || [];
    const totalUses  = json.totalBorrows || 0;

    if (board.length === 0) {
      lbContent.innerHTML = `<div class="lb-loading">No data yet.</div>`;
      return;
    }

    const rows = board.map((u) => `
      <div class="lb-item">
        <span class="lb-rank">${u.rank <= 3 ? ["#1","#2","#3"][u.rank - 1] : u.rank}</span>
        <span class="lb-name">${escapeHtml(u.name)}</span>
        <span class="lb-score">${u.score}<span class="lb-score-label">uses</span></span>
      </div>`).join("");

    lbContent.innerHTML = `
      <div class="lb-list">${rows}</div>
      <p class="lb-total">Campus total: ${totalUses.toLocaleString()} container uses</p>`;

    leaderboardLoaded = true;
  } catch (err) {
    lbContent.innerHTML = `<div class="lb-loading">Failed to load. Tap ↻ to retry.</div>`;
    console.error("[Re:Turn leaderboard]", err);
  }
}

// --- Init Flow -------------------------------------------

async function initApp() {
  await liff.init({ liffId: LIFF_ID });

  const liffProfile = await liff.getProfile();
  const userId      = liffProfile.userId;
  const displayName = liffProfile.displayName || "";
  _currentUserId   = userId;
  _currentUserName = displayName;
  userIdEl.textContent = `ID: ${userId.slice(0, 12)}…`;

  // 1. Render immediately from cache if available
  const cacheKey = `return_dashboard_${userId}`;
  const cached   = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { data } = JSON.parse(cached);
      renderProfile(data, liffProfile);
      renderBorrowing(data.borrowedItems);
      finishLoading();
      // Silently refresh in background
      fetchDashboardData(userId, displayName)
        .then((response) => {
          renderProfile(response.data, liffProfile);
          renderBorrowing(response.data.borrowedItems);
        })
        .catch(() => {}); // silent — user already sees cached data
      return;
    } catch (_) {}
  }

  // 2. No cache: show UI immediately with LIFF profile, lazy-load GAS data
  renderProfile(
    { userName: displayName, usageCount: 0, borrowedItems: [] },
    liffProfile
  );
  finishLoading();
  // borrowing section stays as "Tap Refresh to load"
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
