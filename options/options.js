const PROVIDERS = {
  claude: {
    label: "Claude",
    models: [
      { value: "claude-haiku-5-5", label: "Haiku 5.5 (cheapest)" },
      { value: "claude-sonnet-5-5", label: "Sonnet 5.5 (most capable)" },
    ],
    credentialType: "apiKey",
    keyPlaceholder: "sk-ant-...",
    keyLabel: "Anthropic API Key",
    storageKey: "apiKey_claude",
  },
  openai: {
    label: "OpenAI",
    models: [
      { value: "gpt-6-luna", label: "GPT-6 Luna (cheapest)" },
      { value: "gpt-6.1-sol", label: "GPT-6.1 Sol (most capable)" },
    ],
    credentialType: "apiKey",
    keyPlaceholder: "sk-...",
    keyLabel: "OpenAI API Key",
    storageKey: "apiKey_openai",
  },
  gemini: {
    label: "Gemini",
    models: [
      { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (cheapest)" },
      { value: "gemini-3.8-flash", label: "Gemini 3.8 Flash (most capable)" },
    ],
    credentialType: "apiKey",
    keyPlaceholder: "AIza...",
    keyLabel: "Google AI API Key",
    storageKey: "apiKey_gemini",
  },
  zai: {
    label: "Z.AI",
    models: [
      { value: "glm-5.3", label: "GLM-5.3 (most capable)" },
      { value: "glm-5.2", label: "GLM-5.2" },
      { value: "glm-4.7-flash", label: "GLM-4.7 Flash (cheapest)" },
    ],
    credentialType: "apiKey",
    keyPlaceholder: "xxxxxxxx.xxxxxxxx",
    keyLabel: "Z.AI API Key",
    storageKey: "apiKey_zai",
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
const ALL_KEY_FIELDS = ["apiKey_claude", "apiKey_openai", "apiKey_gemini", "apiKey_zai", "apiKey_ollama", "ollamaUrl"];

const providerTabs = document.getElementById("provider-tabs");
const providerConfig = document.getElementById("provider-config");
const cooldownSelect = document.getElementById("cooldown");
const btnSave = document.getElementById("btn-save");
const statusEl = document.getElementById("status");

let activeProvider = "claude";  // tab currently being viewed/edited
let savedProvider = "claude";   // provider actually in use (from storage)
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

function createRefreshIcon() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const arc = document.createElementNS(ns, "path");
  arc.setAttribute("d", "M13.5 8a5.5 5.5 0 1 1-1.6-3.9");
  svg.appendChild(arc);

  const head = document.createElementNS(ns, "path");
  head.setAttribute("d", "M14 2v3h-3");
  svg.appendChild(head);

  return svg;
}

// Replace the select options with fetched models, preserving the current selection
function rebuildModelSelect(select, models, providerId) {
  const current = select.value;
  select.replaceChildren();

  for (const id of models) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    select.appendChild(opt);
  }

  const known = new Set(models);
  if (providerId === "ollama") {
    // Keep the custom entry available alongside fetched local models
    const opt = document.createElement("option");
    opt.value = "custom";
    opt.textContent = "Custom model...";
    select.appendChild(opt);
    known.add("custom");
  }

  if (known.has(current)) {
    select.value = current;
  } else if (current) {
    const opt = document.createElement("option");
    opt.value = current;
    opt.textContent = `${current} (saved)`;
    select.insertBefore(opt, select.firstChild);
    select.value = current;
  }

  // Re-sync listeners (for example the Ollama custom-field visibility)
  select.dispatchEvent(new Event("change"));
}

// Fetch the provider's model list. Prefers credentials typed in the form over stored ones.
async function fetchAvailableModels(providerId) {
  const config = PROVIDERS[providerId];
  let url;
  const headers = {};

  if (providerId === "ollama") {
    const rawUrl = document.getElementById("ollama-url")?.value.trim()
      || allSavedData.ollamaUrl || "http://localhost:11434";
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error("Invalid Ollama URL.");
    }
    if (parsed.hostname !== "localhost") {
      throw new Error("Ollama URL must be localhost.");
    }
    url = `${rawUrl.replace(/\/$/, "")}/api/tags`;
    if (document.getElementById("ollama-key-required")?.checked) {
      const key = document.getElementById("ollama-api-key")?.value.trim() || allSavedData.apiKey_ollama;
      if (key) headers.Authorization = `Bearer ${key}`;
    }
  } else {
    const key = document.getElementById("api-key")?.value.trim() || allSavedData[config.storageKey];
    if (!key) throw new Error("Save an API key first.");

    if (providerId === "claude") {
      url = "https://api.anthropic.com/v1/models?limit=100";
      headers["x-api-key"] = key;
      headers["anthropic-version"] = "2023-06-01";
      headers["anthropic-dangerous-direct-browser-access"] = "true";
    } else if (providerId === "gemini") {
      url = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000";
      headers["x-goog-api-key"] = key;
    } else if (providerId === "zai") {
      url = "https://api.z.ai/api/paas/v4/models";
      headers.Authorization = `Bearer ${key}`;
    } else {
      url = "https://api.openai.com/v1/models";
      headers.Authorization = `Bearer ${key}`;
    }
  }

  let res;
  try {
    res = await fetch(url, { headers });
  } catch {
    throw new Error("Network error.");
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error("Invalid API key.");
    throw new Error(`Provider returned ${res.status}.`);
  }
  const json = await res.json();
  return extractModelIds(providerId, json);
}

// Normalize provider response shapes and drop non-chat models
function extractModelIds(providerId, json) {
  let ids;

  if (providerId === "gemini") {
    ids = (json.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => String(m.name || "").replace(/^models\//, ""))
      .filter((id) => !/embedding|aqa|veo|imagen|tts|audio|native/i.test(id));
  } else if (providerId === "claude") {
    ids = (json.data || [])
      .map((m) => m.id)
      .filter((id) => typeof id === "string" && id.startsWith("claude"));
  } else if (providerId === "ollama") {
    ids = (json.models || [])
      .map((m) => m.name)
      .filter((id) => typeof id === "string");
  } else {
    // OpenAI and Z.AI share the data[].id shape
    ids = (json.data || [])
      .map((m) => m.id)
      .filter((id) => typeof id === "string");
    if (providerId === "openai") {
      ids = ids.filter((id) => !/embed|whisper|tts|dall-e|image|audio|moderation|transcri|realtime|search|computer-use|batches|codex/i.test(id));
    } else {
      ids = ids.filter((id) => id.startsWith("glm") && !id.includes("image"));
    }
  }

  return [...new Set(ids)].sort();
}

// Z.AI's API does not pass CORS preflight, so it is only reachable with a host
// permission. It is optional and requested on first use, so existing installs
// get no new permission on update unless they actually enable Z.AI.
const ZAI_ORIGINS = ["https://api.z.ai/*"];

async function ensureProviderOrigin(providerId) {
  if (providerId !== "zai") return true;
  if (await browser.permissions.contains({ origins: ZAI_ORIGINS })) return true;
  try {
    return await browser.permissions.request({ origins: ZAI_ORIGINS });
  } catch {
    return false;
  }
}

// --- Provider tabs ---

function renderProviderTabs() {
  providerTabs.replaceChildren();
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
  return !!allSavedData[PROVIDERS[providerId].storageKey];
}

// --- Provider config panel ---

function renderProviderConfig() {
  const config = PROVIDERS[activeProvider];

  providerConfig.replaceChildren();

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
    } else {
      // Keep unknown saved values selectable so they are not lost on save
      const opt = document.createElement("option");
      opt.value = savedModel;
      opt.textContent = `${savedModel} (saved)`;
      modelSelect.insertBefore(opt, modelSelect.firstChild);
      modelSelect.value = savedModel;
    }
  }

  const modelRow = document.createElement("div");
  modelRow.className = "model-row";
  modelRow.appendChild(modelSelect);

  const refreshBtn = document.createElement("button");
  refreshBtn.type = "button";
  refreshBtn.className = "btn-refresh";
  refreshBtn.title = "Load available models from the provider";
  refreshBtn.appendChild(createRefreshIcon());
  refreshBtn.addEventListener("click", async () => {
    refreshBtn.disabled = true;
    refreshBtn.classList.add("loading");
    try {
      if (!(await ensureProviderOrigin(activeProvider))) {
        throw new Error("Allow access to api.z.ai in the permission prompt.");
      }
      const models = await fetchAvailableModels(activeProvider);
      if (models.length === 0) throw new Error("Provider returned no models.");
      rebuildModelSelect(modelSelect, models, activeProvider);
      showStatus(`Loaded ${models.length} models.`, "success");
    } catch (err) {
      showStatus(`Failed to load models: ${err.message}`, "error");
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove("loading");
    }
  });
  modelRow.appendChild(refreshBtn);

  modelField.appendChild(modelRow);
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
        field.replaceChildren();
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

    // Optional API key: editable only while the checkbox is checked
    const keyRequiredField = document.createElement("div");
    keyRequiredField.className = "field field-check";

    const keyCheck = document.createElement("input");
    keyCheck.type = "checkbox";
    keyCheck.id = "ollama-key-required";
    keyCheck.checked = !!allSavedData.ollamaApiKeyRequired;
    keyRequiredField.appendChild(keyCheck);

    const keyCheckLabel = document.createElement("label");
    keyCheckLabel.setAttribute("for", "ollama-key-required");
    keyCheckLabel.textContent = "API Key Required";
    keyRequiredField.appendChild(keyCheckLabel);

    providerConfig.appendChild(keyRequiredField);

    const ollamaKeyField = createField("Ollama API Key", "password", "ollama-api-key", "Bearer token");
    providerConfig.appendChild(ollamaKeyField);
    const ollamaKeyInput = document.getElementById("ollama-api-key");
    ollamaKeyInput.value = allSavedData.apiKey_ollama || "";
    ollamaKeyInput.disabled = !keyCheck.checked;
    keyCheck.addEventListener("change", () => {
      ollamaKeyInput.disabled = !keyCheck.checked;
      if (keyCheck.checked) ollamaKeyInput.focus();
    });

    // Custom model name field
    const customField = createField("Custom Model Name", "text", "custom-model", "e.g. deepseek-r1");
    customField.id = "custom-model-field";
    customField.style.display = "none";
    providerConfig.appendChild(customField);

    const updateCustomVisibility = () => {
      customField.style.display = modelSelect.value === "custom" ? "block" : "none";
    };
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
    "provider", "cooldown", "ollamaApiKeyRequired",
    "model_claude", "model_openai", "model_gemini", "model_zai", "model_ollama",
    ...ALL_KEY_FIELDS,
  ]);
  savedProvider = allSavedData.provider || "claude";
  activeProvider = savedProvider;
  cooldownSelect.value = String(allSavedData.cooldown || 10000);

  renderProviderTabs();
  renderProviderConfig();
}

btnSave.addEventListener("click", async () => {
  const config = PROVIDERS[activeProvider];

  // Ask for the optional Z.AI origin while still inside the click gesture
  if (activeProvider === "zai") {
    const hasKey = !!document.getElementById("api-key")?.value.trim() || !!allSavedData.apiKey_zai;
    if (hasKey && !(await ensureProviderOrigin(activeProvider))) {
      showStatus("Z.AI needs access to api.z.ai — click Save again and allow the permission.", "error");
      return;
    }
  }

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
    const value = document.getElementById("api-key")?.value.trim();
    if (value) {
      toSave[config.storageKey] = value;
    } else if (!allSavedData[config.storageKey]) {
      showStatus("Enter an API key.", "error");
      return;
    }
  } else {
    const urlValue = document.getElementById("ollama-url")?.value.trim();
    if (!urlValue) {
      showStatus("Enter the Ollama URL.", "error");
      return;
    }
    try {
      const parsed = new URL(urlValue);
      if (parsed.hostname !== "localhost") {
        showStatus("Ollama URL must be localhost.", "error");
        return;
      }
    } catch {
      showStatus("Invalid URL.", "error");
      return;
    }
    toSave.ollamaUrl = urlValue;

    // Save the checkbox state; the stored key is only used when checked
    const keyRequired = document.getElementById("ollama-key-required")?.checked || false;
    toSave.ollamaApiKeyRequired = keyRequired;
    if (keyRequired) {
      const keyValue = document.getElementById("ollama-api-key")?.value.trim();
      if (!keyValue) {
        showStatus("Enter the Ollama API key or uncheck \"API Key Required\".", "error");
        return;
      }
      toSave.apiKey_ollama = keyValue;
    }
  }

  await browser.storage.local.set(toSave);

  // Refresh local cache and re-render
  savedProvider = activeProvider;
  allSavedData = await browser.storage.local.get([
    "provider", "cooldown", "ollamaApiKeyRequired",
    "model_claude", "model_openai", "model_gemini", "model_zai", "model_ollama",
    ...ALL_KEY_FIELDS,
  ]);
  renderProviderTabs();
  renderProviderConfig();
  showStatus("Saved!", "success");
});

loadSettings();
