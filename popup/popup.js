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

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

async function init() {
  const { provider, apiKey, ollamaUrl } = await browser.storage.local.get([
    "provider", "apiKey", "ollamaUrl",
  ]);
  const configured = provider === "ollama" ? !!ollamaUrl : !!apiKey;
  if (!configured) {
    showView("noKey");
    return;
  }

  const tabs = await browser.tabs.query({ currentWindow: true });
  document.getElementById("tab-count").textContent = `${tabs.length} tab${tabs.length !== 1 ? "s" : ""} open`;
  showView("ready");
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
    showView("results");
  } catch (err) {
    showError(err.message || "Something went wrong.");
  }
}

function renderGroups(groups) {
  const container = document.getElementById("groups-list");
  clearChildren(container);

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

      if (tab.favIconUrl) {
        const icon = document.createElement("img");
        icon.className = "tab-favicon";
        icon.src = tab.favIconUrl;
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
    showView("done");
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
