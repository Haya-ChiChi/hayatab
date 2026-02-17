const PROVIDERS = {
  claude: {
    label: "Claude",
    models: [
      { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5 (cheapest)" },
      { value: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
      { value: "claude-opus-4-6", label: "Opus 4.6 (most capable)" },
    ],
    credentialType: "apiKey",
    keyPlaceholder: "sk-ant-...",
    keyLabel: "Anthropic API Key",
    storageKey: "apiKey_claude",
  },
  openai: {
    label: "OpenAI",
    models: [
      { value: "gpt-4o-mini", label: "GPT-4o mini (cheapest)" },
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "o3-mini", label: "o3-mini" },
    ],
    credentialType: "apiKey",
    keyPlaceholder: "sk-...",
    keyLabel: "OpenAI API Key",
    storageKey: "apiKey_openai",
  },
  gemini: {
    label: "Gemini",
    models: [
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (cheapest)" },
      { value: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash" },
      { value: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro" },
    ],
    credentialType: "apiKey",
    keyPlaceholder: "AIza...",
    keyLabel: "Google AI API Key",
    storageKey: "apiKey_gemini",
  },
  ollama: {
    label: "Ollama",
    models: [
      { value: "llama3.2", label: "Llama 3.2" },
      { value: "mistral", label: "Mistral" },
      { value: "qwen2.5", label: "Qwen 2.5" },
      { value: "gemma2", label: "Gemma 2" },
      { value: "phi4", label: "Phi-4" },
      { value: "custom", label: "Custom model..." },
    ],
    credentialType: "ollama",
    storageKey: "ollamaUrl",
  },
};

// All per-provider storage keys
const ALL_KEY_FIELDS = ["apiKey_claude", "apiKey_openai", "apiKey_gemini", "ollamaUrl"];

const providerTabs = document.getElementById("provider-tabs");
const providerConfig = document.getElementById("provider-config");
const cooldownSelect = document.getElementById("cooldown");
const btnSave = document.getElementById("btn-save");
const statusEl = document.getElementById("status");

let activeProvider = "claude";  // tab currently being viewed/edited
let savedProvider = "claude";   // provider actually in use (from storage)
let currentModelChangeListener = null;
let allSavedData = {};

function maskKey(key) {
  if (!key || key.length < 12) return "****";
  return key.slice(0, 7) + "..." + key.slice(-4);
}

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = `status ${type}`;
  if (type === "success") setTimeout(() => (statusEl.textContent = ""), 2000);
}

function createField(labelText, inputType, inputId, placeholder) {
  const field = document.createElement("div");
  field.className = "field";

  const label = document.createElement("label");
  label.setAttribute("for", inputId);
  label.textContent = labelText;
  field.appendChild(label);

  const input = document.createElement("input");
  input.type = inputType;
  input.id = inputId;
  input.autocomplete = "off";
  if (placeholder) input.placeholder = placeholder;
  field.appendChild(input);

  return field;
}

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

// --- Provider tabs ---

function renderProviderTabs() {
  clearChildren(providerTabs);
  for (const [id, config] of Object.entries(PROVIDERS)) {
    const isViewing = id === activeProvider;
    const isInUse = id === savedProvider;
    const hasCredential = isProviderConfigured(id);

    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "provider-tab" + (isViewing ? " active" : "");
    tab.dataset.provider = id;

    const name = document.createElement("span");
    name.className = "provider-tab-name";
    name.textContent = config.label;
    tab.appendChild(name);

    const indicator = document.createElement("span");
    indicator.className = "status-indicator";
    if (isInUse) {
      const badge = document.createElement("span");
      badge.className = "in-use-badge";
      badge.textContent = "In use";
      indicator.appendChild(badge);
    } else if (hasCredential) {
      const dot = document.createElement("span");
      dot.className = "status-dot configured";
      dot.title = "Key saved";
      indicator.appendChild(dot);
    }
    tab.appendChild(indicator);

    tab.addEventListener("click", () => {
      activeProvider = id;
      renderProviderTabs();
      renderProviderConfig();
    });
    providerTabs.appendChild(tab);
  }
}

function isProviderConfigured(providerId) {
  const config = PROVIDERS[providerId];
  if (config.credentialType === "ollama") {
    return !!allSavedData.ollamaUrl;
  }
  return !!allSavedData[config.storageKey];
}

// --- Provider config panel ---

function renderProviderConfig() {
  const config = PROVIDERS[activeProvider];

  // Remove stale listener
  if (currentModelChangeListener) {
    const modelEl = document.getElementById("model");
    if (modelEl) modelEl.removeEventListener("change", currentModelChangeListener);
    currentModelChangeListener = null;
  }

  clearChildren(providerConfig);

  // Model dropdown
  const modelField = document.createElement("div");
  modelField.className = "field";

  const modelLabel = document.createElement("label");
  modelLabel.setAttribute("for", "model");
  modelLabel.textContent = "Model";
  modelField.appendChild(modelLabel);

  const modelSelect = document.createElement("select");
  modelSelect.id = "model";
  for (const m of config.models) {
    const opt = document.createElement("option");
    opt.value = m.value;
    opt.textContent = m.label;
    modelSelect.appendChild(opt);
  }

  // Restore saved model
  const savedModel = allSavedData["model_" + activeProvider];
  if (savedModel) {
    const knownValues = config.models.map((m) => m.value);
    if (knownValues.includes(savedModel)) {
      modelSelect.value = savedModel;
    } else if (activeProvider === "ollama") {
      modelSelect.value = "custom";
    }
  }

  modelField.appendChild(modelSelect);
  providerConfig.appendChild(modelField);

  // Credential fields
  if (config.credentialType === "apiKey") {
    const savedKey = allSavedData[config.storageKey];
    if (savedKey) {
      // Show masked key with change button
      const field = document.createElement("div");
      field.className = "field";

      const label = document.createElement("label");
      label.textContent = config.keyLabel;
      field.appendChild(label);

      const keyRow = document.createElement("div");
      keyRow.className = "key-display-row";

      const masked = document.createElement("span");
      masked.className = "key-display";
      masked.textContent = maskKey(savedKey);
      keyRow.appendChild(masked);

      const changeBtn = document.createElement("button");
      changeBtn.type = "button";
      changeBtn.className = "btn btn-secondary btn-sm";
      changeBtn.textContent = "Change";
      changeBtn.addEventListener("click", () => {
        // Replace with editable input
        clearChildren(field);
        const newLabel = document.createElement("label");
        newLabel.setAttribute("for", "api-key");
        newLabel.textContent = config.keyLabel;
        field.appendChild(newLabel);
        const input = document.createElement("input");
        input.type = "password";
        input.id = "api-key";
        input.autocomplete = "off";
        input.placeholder = config.keyPlaceholder;
        field.appendChild(input);
        input.focus();
      });
      keyRow.appendChild(changeBtn);

      field.appendChild(keyRow);
      providerConfig.appendChild(field);
    } else {
      // No key - show empty input
      const field = createField(config.keyLabel, "password", "api-key", config.keyPlaceholder);
      providerConfig.appendChild(field);
    }
  } else {
    // Ollama: URL field
    const urlField = createField("Ollama URL", "text", "ollama-url", "http://localhost:11434");
    providerConfig.appendChild(urlField);
    document.getElementById("ollama-url").value = allSavedData.ollamaUrl || "http://localhost:11434";

    // Custom model name field
    const customField = createField("Custom Model Name", "text", "custom-model", "e.g. deepseek-r1");
    customField.id = "custom-model-field";
    customField.style.display = "none";
    providerConfig.appendChild(customField);

    const updateCustomVisibility = () => {
      customField.style.display = modelSelect.value === "custom" ? "block" : "none";
    };
    currentModelChangeListener = updateCustomVisibility;
    modelSelect.addEventListener("change", updateCustomVisibility);
    updateCustomVisibility();

    // Restore custom model
    if (savedModel && modelSelect.value === "custom") {
      document.getElementById("custom-model").value = savedModel;
    }
  }
}

// --- Load / Save ---

async function loadSettings() {
  allSavedData = await browser.storage.local.get([
    "provider", "cooldown",
    "model_claude", "model_openai", "model_gemini", "model_ollama",
    ...ALL_KEY_FIELDS,
  ]);
  savedProvider = allSavedData.provider || "claude";
  activeProvider = savedProvider;
  cooldownSelect.value = String(allSavedData.cooldown || 10000);

  // Migration: move old shared `apiKey` to the active provider's key
  const oldData = await browser.storage.local.get(["apiKey", "model"]);
  if (oldData.apiKey) {
    const targetKey = PROVIDERS[activeProvider]?.storageKey;
    if (targetKey && !allSavedData[targetKey]) {
      allSavedData[targetKey] = oldData.apiKey;
      const migration = { [targetKey]: oldData.apiKey };
      // Also migrate old shared model
      if (oldData.model) {
        allSavedData["model_" + activeProvider] = oldData.model;
        migration["model_" + activeProvider] = oldData.model;
      }
      await browser.storage.local.set(migration);
      await browser.storage.local.remove(["apiKey", "model"]);
    }
  }

  renderProviderTabs();
  renderProviderConfig();
}

btnSave.addEventListener("click", async () => {
  const config = PROVIDERS[activeProvider];
  const toSave = {
    provider: activeProvider,
    cooldown: parseInt(cooldownSelect.value, 10),
  };

  // Resolve model
  const modelSelect = document.getElementById("model");
  let model = modelSelect.value;
  if (activeProvider === "ollama" && model === "custom") {
    const customModel = document.getElementById("custom-model")?.value.trim();
    if (!customModel) {
      showStatus("Enter a custom model name.", "error");
      return;
    }
    toSave["model_ollama"] = customModel;
  } else {
    toSave["model_" + activeProvider] = model;
  }

  // Resolve credentials (per-provider)
  if (config.credentialType === "apiKey") {
    const keyInput = document.getElementById("api-key");
    const value = keyInput?.value?.trim();
    if (value) {
      toSave[config.storageKey] = value;
    }
    // If no input visible (masked display), keep existing key
  } else {
    const urlValue = document.getElementById("ollama-url")?.value.trim();
    if (!urlValue) {
      showStatus("Enter the Ollama URL.", "error");
      return;
    }
    try {
      const parsed = new URL(urlValue);
      if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
        showStatus("Ollama URL must be localhost.", "error");
        return;
      }
    } catch {
      showStatus("Invalid URL.", "error");
      return;
    }
    toSave.ollamaUrl = urlValue;
  }

  await browser.storage.local.set(toSave);

  // Refresh local cache and re-render
  savedProvider = activeProvider;
  allSavedData = await browser.storage.local.get([
    "provider", "cooldown",
    "model_claude", "model_openai", "model_gemini", "model_ollama",
    ...ALL_KEY_FIELDS,
  ]);
  renderProviderTabs();
  renderProviderConfig();
  showStatus("Saved!", "success");
});

loadSettings();
