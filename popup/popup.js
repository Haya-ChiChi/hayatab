const views = {
  noKey: document.getElementById("view-no-key"),
  ready: document.getElementById("view-ready"),
  loading: document.getElementById("view-loading"),
  results: document.getElementById("view-results"),
  error: document.getElementById("view-error"),
  done: document.getElementById("view-done"),
};

let currentGroups = [];

function showView(name) {
  Object.values(views).forEach((v) => v.classList.add("hidden"));
  views[name]?.classList.remove("hidden");
}

function showError(message) {
  document.getElementById("error-message").textContent = message;
  showView("error");
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

const PROVIDER_NAMES = { claude: "Claude", openai: "OpenAI", gemini: "Gemini", zai: "Z.AI", ollama: "Ollama", custom: "Custom API" };

function formatModelName(model) {
  if (!model) return "";
  // Strip date suffixes like "-20251001" and preview tags
  return model
    .replace(/-\d{8}$/, "")
    .replace(/-preview.*$/, "")
    .replace(/^claude-/, "")
    .replace(/^gpt-/, "GPT-")
    .replace(/^gemini-/, "Gemini ")
    .replace(/^glm-/, "GLM-");
}

async function init() {
  const data = await browser.storage.local.get([
    "provider", "ollamaUrl", "customBaseUrl",
    "apiKey_claude", "apiKey_openai", "apiKey_gemini", "apiKey_zai", "apiKey_custom",
    "model_claude", "model_openai", "model_gemini", "model_zai", "model_ollama", "model_custom",
  ]);
  const provider = data.provider || "claude";
  const apiKey = data["apiKey_" + provider];
  const configured = provider === "ollama" ? !!data.ollamaUrl : provider === "custom" ? !!data.customBaseUrl : !!apiKey;
  if (!configured) {
    showView("noKey");
    return;
  }

  // On Android the popup itself opens as a tab, so currentWindow would scope
  // to the popup's window. Count the tabs in the user's window instead.
  const allTabs = await browser.tabs.query({});
  const extensionPrefix = browser.runtime.getURL("");
  const userTabs = allTabs.filter((t) => !t.pinned && !t.hidden && !(typeof t.url === "string" && t.url.startsWith(extensionPrefix)));
  const activeTab = userTabs.find((t) => t.active);
  const tabs = activeTab ? userTabs.filter((t) => t.windowId === activeTab.windowId) : userTabs;
  document.getElementById("tab-count").textContent = `${tabs.length} tab${tabs.length !== 1 ? "s" : ""} open`;

  const model = data["model_" + provider] || "";
  const providerName = PROVIDER_NAMES[provider] || provider;
  const modelName = formatModelName(model);
  document.getElementById("provider-label").textContent =
    modelName ? `${providerName} \u00B7 ${modelName}` : providerName;

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
  document.querySelector("#view-loading .message").textContent = "Analyzing your tabs...";
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

function renderGroups(groups) {
  const container = document.getElementById("groups-list");
  container.replaceChildren();

  groups.forEach((group, groupIndex) => {
    const card = document.createElement("div");
    card.className = `group-card group-color-${group.color}`;
    card.style.setProperty('--i', groupIndex);

    const header = document.createElement("div");
    header.className = "group-header";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "group-name-input";
    nameInput.value = group.name;
    nameInput.dataset.index = groupIndex;
    nameInput.addEventListener("input", (e) => {
      currentGroups[groupIndex].name = e.target.value;
    });

    const count = document.createElement("span");
    count.className = "group-count";
    count.textContent = `${group.tabIds.length}`;

    header.appendChild(nameInput);
    header.appendChild(count);
    card.appendChild(header);

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
        icon.onerror = () => icon.remove();
        li.appendChild(icon);
      }

      const title = document.createElement("span");
      title.className = "tab-title";
      title.textContent = tab.title || "Untitled";
      li.appendChild(title);

      tabList.appendChild(li);
    });

    card.appendChild(tabList);
    container.appendChild(card);
  });
}

async function applyGroups() {
  showView("loading");
  document.querySelector("#view-loading .message").textContent = "Applying groups...";
  try {
    const response = await browser.runtime.sendMessage({
      action: "applyGroups",
      groups: currentGroups,
    });
    if (!response.ok) {
      showError(response.error);
      return;
    }
    if (response.sortedOnly) {
      document.querySelector("#view-done .done-text").textContent = "Tabs sorted by group!";
    }
    showView("done");
    // On Android the popup is a tab, and window.close() does not dismiss it;
    // close our own popup tab explicitly. On desktop getCurrent() returns
    // nothing for a popup, so this is a no-op there.
    try {
      const self = await browser.tabs.getCurrent();
      if (self && typeof self.url === "string" && self.url.startsWith(browser.runtime.getURL(""))) {
        setTimeout(() => browser.tabs.remove(self.id), 1200);
        return;
      }
    } catch {
      // tabs.getCurrent unavailable - fall through to window.close()
    }
    setTimeout(() => window.close(), 1200);
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
