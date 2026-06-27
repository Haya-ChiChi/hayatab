const views = {
  noKey: document.getElementById("view-no-key"),
  ready: document.getElementById("view-ready"),
  loading: document.getElementById("view-loading"),
  results: document.getElementById("view-results"),
  error: document.getElementById("view-error"),
  done: document.getElementById("view-done"),
};

let currentGroups = [];

// ── Theme (Light / Dark / System) ──
async function applyStoredTheme() {
  try {
    const { appearance } = await browser.storage.local.get("appearance");
    const root = document.documentElement;
    if (appearance === "light" || appearance === "dark") {
      root.setAttribute("data-theme", appearance);
    } else {
      root.removeAttribute("data-theme");
    }
  } catch {
    /* storage unavailable — fall back to system */
  }
}

// ── Loading: shuffling-list sort animation ──
let sortTimer = null;
function startSort() {
  const list = document.getElementById("sort-list");
  if (!list) return;
  const step = 22;
  const run = () => {
    const rows = Array.from(list.children);
    const order = rows.map((_, i) => i).sort(() => 0.5 - Math.random());
    rows.forEach((row, i) => {
      const newPos = order[i];
      const oldPos = parseInt(row.dataset.pos || i, 10);
      row.style.top = newPos * step + "px";
      row.dataset.pos = newPos;
      const dir = newPos < oldPos ? 1 : newPos > oldPos ? -1 : 0;
      row.style.zIndex = dir > 0 ? 2 : dir < 0 ? 0 : 1;
      if (dir !== 0 && row.animate) {
        row.animate(
          [{ transform: "scale(1)" }, { transform: dir > 0 ? "scale(1.13)" : "scale(0.88)" }, { transform: "scale(1)" }],
          { duration: 480, easing: "ease-out" }
        );
      }
    });
  };
  stopSort();
  sortTimer = setInterval(run, 1500);
  setTimeout(run, 450);
}
function stopSort() {
  if (sortTimer) {
    clearInterval(sortTimer);
    sortTimer = null;
  }
}

function showView(name) {
  Object.values(views).forEach((v) => v.classList.add("hidden"));
  views[name]?.classList.remove("hidden");
  if (name === "loading") startSort();
  else stopSort();
}

function showError(message) {
  document.getElementById("error-message").textContent = message;
  showView("error");
}

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function formatRelativeTime(timestamp) {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin === 1) return "1 min ago";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return "1 hr ago";
  return `${diffHr} hr ago`;
}

function showStaleIndicator(timestamp) {
  const el = document.getElementById("stale-indicator");
  el.textContent = `From previous analysis · ${formatRelativeTime(timestamp)}`;
  el.classList.remove("hidden");
}

function hideStaleIndicator() {
  document.getElementById("stale-indicator").classList.add("hidden");
}

const PROVIDER_NAMES = { claude: "Claude", openai: "OpenAI", gemini: "Gemini", ollama: "Ollama" };

function formatModelName(model) {
  if (!model) return "";
  return model
    .replace(/-\d{8}$/, "")
    .replace(/-preview.*$/, "")
    .replace(/^claude-/, "")
    .replace(/^gpt-/, "GPT-")
    .replace(/^gemini-/, "Gemini ");
}

async function init() {
  applyStoredTheme();

  const data = await browser.storage.local.get([
    "provider", "ollamaUrl",
    "apiKey_claude", "apiKey_openai", "apiKey_gemini",
    "apiKey", // legacy fallback
    "model_claude", "model_openai", "model_gemini", "model_ollama",
    "model", // legacy fallback
  ]);
  const provider = data.provider || "claude";
  const providerKeyMap = { claude: "apiKey_claude", openai: "apiKey_openai", gemini: "apiKey_gemini" };
  const apiKey = data[providerKeyMap[provider]] || data.apiKey || "";
  const configured = provider === "ollama" ? !!data.ollamaUrl : !!apiKey;
  if (!configured) {
    showView("noKey");
    return;
  }

  const tabs = await browser.tabs.query({ currentWindow: true });
  document.getElementById("tab-count").textContent = String(tabs.length);

  const model = data["model_" + provider] || data.model || "";
  const providerName = PROVIDER_NAMES[provider] || provider;
  const modelName = formatModelName(model);
  const label = modelName ? `${providerName} \u00B7 ${modelName}` : providerName;
  document.getElementById("provider-label").textContent = label.toUpperCase();

  const pending = await browser.runtime.sendMessage({ action: "getPendingGroups" });
  if (pending.ok && pending.groups) {
    currentGroups = pending.groups;
    renderGroups(currentGroups);
    showStaleIndicator(pending.timestamp);
    showView("results");
  } else {
    showView("ready");
  }
}

async function analyzeTabs() {
  showView("loading");
  document.querySelector("#view-loading .message").textContent = "Analyzing your tabs…";
  document.getElementById("loading-sub").textContent = "Reading tabs · grouping";
  try {
    const response = await browser.runtime.sendMessage({ action: "analyzeTabs" });
    if (!response.ok) {
      showError(response.error);
      return;
    }
    currentGroups = response.groups;
    renderGroups(currentGroups);
    hideStaleIndicator();
    showView("results");
  } catch (err) {
    showError(err.message || "Something went wrong.");
  }
}

function faviconLetter(tab) {
  const src = tab.title || tab.url || "?";
  const m = src.replace(/^https?:\/\/(www\.)?/i, "").match(/[a-z0-9]/i);
  return (m ? m[0] : "?").toUpperCase();
}

function renderGroups(groups) {
  const container = document.getElementById("groups-list");
  clearChildren(container);

  const totalTabs = groups.reduce((sum, g) => sum + g.tabIds.length, 0);
  const totalEl = document.getElementById("group-count-total");
  if (totalEl) totalEl.textContent = String(groups.length);

  groups.forEach((group, groupIndex) => {
    const card = document.createElement("div");
    card.className = `group-card group-color-${group.color}`;
    card.style.setProperty("--i", groupIndex);

    const spine = document.createElement("div");
    spine.className = "group-spine";
    card.appendChild(spine);

    const bodyEl = document.createElement("div");
    bodyEl.className = "group-body";

    const header = document.createElement("div");
    header.className = "group-header";

    const index = document.createElement("span");
    index.className = "group-index";
    index.textContent = String(groupIndex + 1).padStart(2, "0");
    header.appendChild(index);

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "group-name-input";
    nameInput.value = group.name;
    nameInput.dataset.index = groupIndex;
    nameInput.addEventListener("input", (e) => {
      currentGroups[groupIndex].name = e.target.value;
    });
    header.appendChild(nameInput);

    const count = document.createElement("span");
    count.className = "group-count";
    const n = group.tabIds.length;
    count.textContent = `${n} ${n === 1 ? "TAB" : "TABS"}`;
    header.appendChild(count);

    bodyEl.appendChild(header);

    const tabList = document.createElement("ul");
    tabList.className = "tab-list";

    const tabs = group.tabs || [];
    tabs.forEach((tab) => {
      const li = document.createElement("li");
      li.className = "tab-item";
      li.title = tab.url || "";

      const safeIconUrl = tab.favIconUrl && /^https?:\/\//i.test(tab.favIconUrl) ? tab.favIconUrl : null;
      if (safeIconUrl) {
        const icon = document.createElement("img");
        icon.className = "tab-favicon";
        icon.src = safeIconUrl;
        icon.width = 14;
        icon.height = 14;
        icon.onerror = () => {
          const fb = document.createElement("span");
          fb.className = "tab-favicon-fallback";
          fb.textContent = faviconLetter(tab);
          icon.replaceWith(fb);
        };
        li.appendChild(icon);
      } else {
        const fb = document.createElement("span");
        fb.className = "tab-favicon-fallback";
        fb.textContent = faviconLetter(tab);
        li.appendChild(fb);
      }

      const title = document.createElement("span");
      title.className = "tab-title";
      title.textContent = tab.title || "Untitled";
      li.appendChild(title);

      tabList.appendChild(li);
    });

    bodyEl.appendChild(tabList);
    card.appendChild(bodyEl);
    container.appendChild(card);
  });
}

async function applyGroups() {
  showView("loading");
  document.querySelector("#view-loading .message").textContent = "Applying groups…";
  document.getElementById("loading-sub").textContent = "Organizing tabs";

  const groupCount = currentGroups.length;
  const tabCount = currentGroups.reduce((sum, g) => sum + g.tabIds.length, 0);

  try {
    const response = await browser.runtime.sendMessage({
      action: "applyGroups",
      groups: currentGroups,
    });
    if (!response.ok) {
      showError(response.error);
      return;
    }
    document.querySelector("#view-done .done-text").textContent = response.sortedOnly
      ? "Tabs sorted by group!"
      : "Tabs organized!";
    document.getElementById("done-summary").textContent =
      `${groupCount} ${groupCount === 1 ? "group" : "groups"} · ${tabCount} ${tabCount === 1 ? "tab" : "tabs"}`;
    showView("done");
    setTimeout(() => window.close(), 1300);
  } catch (err) {
    showError(err.message || "Failed to apply groups.");
  }
}

// Event listeners
document.getElementById("btn-open-options").addEventListener("click", () => {
  browser.runtime.openOptionsPage();
  window.close();
});
document.getElementById("btn-settings").addEventListener("click", () => {
  browser.runtime.openOptionsPage();
  window.close();
});

document.getElementById("btn-analyze").addEventListener("click", analyzeTabs);
document.getElementById("btn-reanalyze").addEventListener("click", analyzeTabs);
document.getElementById("btn-apply").addEventListener("click", applyGroups);
document.getElementById("btn-retry").addEventListener("click", () => showView("ready"));

init();
