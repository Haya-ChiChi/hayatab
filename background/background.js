const SYSTEM_PROMPT = `You are a tab organization assistant. Analyze browser tabs and group them into logical categories.

Rules:
1. Every tab must be assigned to exactly one group. No tab may be left ungrouped.
2. Create between 2 and 8 groups. Merge similar topics rather than creating many small groups.
3. Group names must be short (1-3 words), title-case, and immediately understandable (e.g., "Work Email", "YouTube", "Shopping", "GitHub").
4. If only 1-3 tabs exist, use 1-2 groups.
5. Base grouping on semantic meaning, not just domain. Two Stack Overflow tabs about different projects may belong in different groups.
6. Use only these colors: blue, cyan, grey, green, orange, pink, purple, red, yellow. Assign different colors to each group.

Respond ONLY with valid JSON matching this schema. No prose, no markdown fences, no explanation.

{
  "groups": [
    {
      "name": "string (1-3 words, title-case)",
      "color": "blue|cyan|grey|green|orange|pink|purple|red|yellow",
      "tabIds": [integer tab IDs from the input]
    }
  ]
}`;

const DEFAULT_COOLDOWN_MS = 10_000;

const handlers = {
  analyzeTabs: handleAnalyzeTabs,
  applyGroups: handleApplyGroups,
};

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = handlers[message.action];
  if (!handler) {
    sendResponse({ ok: false, error: `Unknown action: ${message.action}` });
    return false;
  }
  handler(message)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: err.message }));
  return true; // keep message channel open for async response
});

async function handleAnalyzeTabs() {
  const settings = await browser.storage.local.get([
    "provider", "model", "apiKey", "ollamaUrl", "cooldown", "lastAnalysisTime",
  ]);

  const provider = settings.provider || "claude";

  // Validate config
  if (provider === "ollama") {
    if (!settings.ollamaUrl) throw new Error("No Ollama URL configured. Open extension settings.");
  } else {
    if (!settings.apiKey) throw new Error("No API key configured. Open extension settings.");
  }

  // Rate limiting
  const cooldown = settings.cooldown || DEFAULT_COOLDOWN_MS;
  const now = Date.now();
  if (settings.lastAnalysisTime && (now - settings.lastAnalysisTime) < cooldown) {
    const wait = Math.ceil((cooldown - (now - settings.lastAnalysisTime)) / 1000);
    throw new Error(`Please wait ${wait}s before analyzing again.`);
  }
  await browser.storage.local.set({ lastAnalysisTime: now });

  const tabs = await browser.tabs.query({ currentWindow: true, pinned: false });
  if (tabs.length === 0) throw new Error("No tabs to organize.");

  const tabData = tabs.map((t) => ({ id: t.id, title: t.title, url: t.url }));
  const apiResponse = await callAPI(provider, settings, tabData);
  const text = extractText(provider, apiResponse);
  const groups = parseAndValidateGroups(
    text,
    tabs.map((t) => t.id)
  );

  // Attach tab titles so popup can display them
  const tabMap = Object.fromEntries(tabs.map((t) => [t.id, { title: t.title, url: t.url, favIconUrl: t.favIconUrl }]));
  for (const group of groups) {
    group.tabs = group.tabIds.map((id) => ({ id, ...tabMap[id] }));
  }

  return { ok: true, groups };
}

async function handleApplyGroups({ groups }) {
  const currentTabs = await browser.tabs.query({ currentWindow: true });
  if (currentTabs.length === 0) throw new Error("No open tabs found.");
  const validTabIds = new Set(currentTabs.map((t) => t.id));
  const windowId = currentTabs[0].windowId;

  let applied = 0;
  for (const group of groups) {
    // Filter out tabs that were closed since analysis
    const validIds = group.tabIds.filter((id) => validTabIds.has(id));
    if (validIds.length === 0) continue;

    try {
      const groupId = await browser.tabs.group({
        tabIds: validIds,
        createProperties: { windowId },
      });

      if (browser.tabGroups?.update) {
        await browser.tabGroups.update(groupId, {
          title: group.name,
          color: group.color,
        });
      }
      applied++;
    } catch (err) {
      console.warn(`Failed to create group "${group.name}":`, err);
    }
  }

  if (applied === 0) throw new Error("No groups could be applied. Try re-analyzing.");
  return { ok: true };
}

async function callAPI(provider, settings, tabData) {
  const { model, apiKey, ollamaUrl } = settings;
  const userMessage = `Organize these tabs:\n${JSON.stringify(tabData, null, 2)}`;

  let url, headers, body;

  switch (provider) {
    case "openai": {
      url = "https://api.openai.com/v1/chat/completions";
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };
      body = {
        model: model || "gpt-4o-mini",
        max_tokens: 1024,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      };
      break;
    }
    case "gemini": {
      const m = model || "gemini-2.0-flash";
      url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      headers = { "Content-Type": "application/json" };
      body = {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 1024 },
      };
      break;
    }
    case "ollama": {
      const base = (ollamaUrl || "http://localhost:11434").replace(/\/$/, "");
      url = `${base}/api/chat`;
      headers = { "Content-Type": "application/json" };
      body = {
        model: model || "llama3.2",
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      };
      break;
    }
    case "claude":
    default: {
      url = "https://api.anthropic.com/v1/messages";
      headers = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      };
      body = {
        model: model || "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      };
    }
  }

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (fetchErr) {
    throw new Error(`Network error: ${fetchErr.message}`);
  }

  if (!res.ok) {
    if (res.status === 401) throw new Error("Invalid API key. Check Settings.");
    if (res.status === 429) throw new Error("Rate limited by provider. Wait a moment and try again.");
    // Try JSON first (Claude/OpenAI/Gemini), fall back to plain text (Ollama)
    const errText = await res.text().catch(() => "");
    let errMsg = `API error (${res.status})`;
    try {
      const errJson = JSON.parse(errText);
      errMsg = errJson.error?.message || errJson.message || errMsg;
    } catch {
      if (errText) errMsg = errText.slice(0, 200);
    }
    throw new Error(errMsg);
  }

  return await res.json();
}

function extractText(provider, apiResponse) {
  let text;
  switch (provider) {
    case "openai":
      text = apiResponse.choices?.[0]?.message?.content;
      break;
    case "gemini":
      text = apiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      break;
    case "ollama":
      text = apiResponse.message?.content;
      break;
    case "claude":
    default:
      text = apiResponse.content?.[0]?.text;
  }
  if (!text) throw new Error("Empty response from AI provider. Try again.");
  return text;
}

function parseAndValidateGroups(text, allTabIds) {
  let parsed;
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("AI returned invalid JSON. Try again.");
  }

  if (!Array.isArray(parsed.groups) || parsed.groups.length === 0) {
    throw new Error("Response missing groups. Try again.");
  }

  const validColors = new Set(["blue", "cyan", "grey", "green", "orange", "pink", "purple", "red", "yellow"]);
  const allTabIdSet = new Set(allTabIds);

  const assignedIds = new Set();
  for (const group of parsed.groups) {
    // Validate color
    if (!validColors.has(group.color)) group.color = "grey";
    // Filter out invalid tab IDs and deduplicate across groups
    group.tabIds = group.tabIds.filter((id) => {
      if (!allTabIdSet.has(id) || assignedIds.has(id)) return false;
      assignedIds.add(id);
      return true;
    });
  }

  // Remove empty groups
  parsed.groups = parsed.groups.filter((g) => g.tabIds.length > 0);

  // Find orphaned tabs
  const missingIds = allTabIds.filter((id) => !assignedIds.has(id));
  if (missingIds.length > 0) {
    parsed.groups.push({ name: "Other", color: "grey", tabIds: missingIds });
  }

  return parsed.groups;
}
