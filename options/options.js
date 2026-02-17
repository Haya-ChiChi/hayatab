const PROVIDERS = {
  claude: {
    models: [
      { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5 (cheapest)" },
      { value: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
      { value: "claude-opus-4-6", label: "Opus 4.6 (most capable)" },
    ],
    credentialType: "apiKey",
    keyPlaceholder: "sk-ant-...",
    keyLabel: "Anthropic API Key",
  },
  openai: {
    models: [
      { value: "gpt-4o-mini", label: "GPT-4o mini (cheapest)" },
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "o3-mini", label: "o3-mini" },
    ],
    credentialType: "apiKey",
    keyPlaceholder: "sk-...",
    keyLabel: "OpenAI API Key",
  },
  gemini: {
    models: [
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (cheapest)" },
      { value: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash" },
      { value: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro" },
    ],
    credentialType: "apiKey",
    keyPlaceholder: "AIza...",
    keyLabel: "Google AI API Key",
  },
  ollama: {
    models: [
      { value: "llama3.2", label: "Llama 3.2" },
      { value: "mistral", label: "Mistral" },
      { value: "qwen2.5", label: "Qwen 2.5" },
      { value: "gemma2", label: "Gemma 2" },
      { value: "phi4", label: "Phi-4" },
      { value: "custom", label: "Custom model..." },
    ],
    credentialType: "ollama",
  },
};

const providerSelect = document.getElementById("provider");
const modelSelect = document.getElementById("model");
const credentialFields = document.getElementById("credential-fields");
const cooldownSelect = document.getElementById("cooldown");
const btnSave = document.getElementById("btn-save");
const statusEl = document.getElementById("status");

let currentModelChangeListener = null;

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

function renderProviderFields(provider, savedData = {}) {
  const config = PROVIDERS[provider];

  // Remove stale model change listener from previous render
  if (currentModelChangeListener) {
    modelSelect.removeEventListener("change", currentModelChangeListener);
    currentModelChangeListener = null;
  }

  // Update model dropdown
  clearChildren(modelSelect);
  for (const m of config.models) {
    const opt = document.createElement("option");
    opt.value = m.value;
    opt.textContent = m.label;
    modelSelect.appendChild(opt);
  }

  // Restore saved model selection
  if (savedData.model) {
    const knownValues = config.models.map((m) => m.value);
    if (knownValues.includes(savedData.model)) {
      modelSelect.value = savedData.model;
    } else if (provider === "ollama") {
      modelSelect.value = "custom";
    }
  }

  // Update credential fields
  clearChildren(credentialFields);

  if (config.credentialType === "apiKey") {
    const field = createField(config.keyLabel, "password", "api-key", config.keyPlaceholder);
    credentialFields.appendChild(field);

    if (savedData.apiKey) {
      document.getElementById("api-key").placeholder = maskKey(savedData.apiKey);
    }
  } else {
    // Ollama: URL field
    const urlField = createField("Ollama URL", "text", "ollama-url", "http://localhost:11434");
    credentialFields.appendChild(urlField);
    const urlInput = document.getElementById("ollama-url");
    urlInput.value = savedData.ollamaUrl || "http://localhost:11434";

    // Ollama: Custom model name field (hidden unless "custom" selected)
    const customField = createField("Custom Model Name", "text", "custom-model", "e.g. deepseek-r1");
    customField.id = "custom-model-field";
    customField.style.display = "none";
    credentialFields.appendChild(customField);

    const updateCustomVisibility = () => {
      customField.style.display = modelSelect.value === "custom" ? "block" : "none";
    };
    currentModelChangeListener = updateCustomVisibility;
    modelSelect.addEventListener("change", updateCustomVisibility);
    updateCustomVisibility();

    // Restore custom model name
    if (savedData.model && modelSelect.value === "custom") {
      document.getElementById("custom-model").value = savedData.model;
    }
  }
}

async function loadSettings() {
  const saved = await browser.storage.local.get([
    "provider", "model", "apiKey", "ollamaUrl", "cooldown",
  ]);
  const provider = saved.provider || "claude";
  providerSelect.value = provider;
  if (saved.cooldown) cooldownSelect.value = String(saved.cooldown);
  renderProviderFields(provider, saved);
}

providerSelect.addEventListener("change", () => {
  renderProviderFields(providerSelect.value);
});

btnSave.addEventListener("click", async () => {
  const provider = providerSelect.value;
  const config = PROVIDERS[provider];
  const toSave = {
    provider,
    cooldown: parseInt(cooldownSelect.value, 10),
  };

  // Resolve model
  let model = modelSelect.value;
  if (provider === "ollama" && model === "custom") {
    const customModel = document.getElementById("custom-model")?.value.trim();
    if (!customModel) {
      showStatus("Enter a custom model name.", "error");
      return;
    }
    toSave.model = customModel;
  } else {
    toSave.model = model;
  }

  // Check if provider changed — clear stale credentials
  const { provider: prevProvider } = await browser.storage.local.get("provider");
  const providerChanged = prevProvider && prevProvider !== provider;

  // Resolve credentials
  if (config.credentialType === "apiKey") {
    const keyInput = document.getElementById("api-key");
    const value = keyInput?.value.trim();
    if (value) {
      toSave.apiKey = value;
    } else if (providerChanged) {
      // Provider changed but no new key entered — clear the old one
      toSave.apiKey = "";
    }
    // If same provider and empty input, keep existing key
    toSave.ollamaUrl = ""; // clear any leftover Ollama URL
  } else {
    const urlValue = document.getElementById("ollama-url")?.value.trim();
    if (!urlValue) {
      showStatus("Enter the Ollama URL.", "error");
      return;
    }
    // Validate localhost-only (manifest only permits http://localhost/*)
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
    toSave.apiKey = ""; // clear any leftover key
  }

  await browser.storage.local.set(toSave);

  // Clear key input and update placeholder
  if (config.credentialType === "apiKey") {
    const keyInput = document.getElementById("api-key");
    if (keyInput?.value) {
      keyInput.placeholder = maskKey(keyInput.value);
      keyInput.value = "";
    }
  }

  showStatus("Saved!", "success");
});

loadSettings();
