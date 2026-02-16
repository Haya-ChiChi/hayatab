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
  const { apiKey } = await browser.storage.local.get("apiKey");
  if (!apiKey) throw new Error("No API key configured. Open extension settings.");

  const tabs = await browser.tabs.query({ currentWindow: true, pinned: false });
  if (tabs.length === 0) throw new Error("No tabs to organize.");

  const tabData = tabs.map((t) => ({ id: t.id, title: t.title, url: t.url }));
  const response = await callClaudeAPI(apiKey, tabData);
  const groups = parseAndValidateGroups(
    response,
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
  const validTabIds = new Set(currentTabs.map((t) => t.id));
  const windowId = currentTabs[0]?.windowId;

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

async function callClaudeAPI(apiKey, tabData) {
  const body = {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Organize these tabs:\n${JSON.stringify(tabData, null, 2)}`,
      },
    ],
  };

  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });
  } catch (fetchErr) {
    throw new Error(`Network error: ${fetchErr.message}`);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("Invalid API key. Check Settings.");
    if (res.status === 429) throw new Error("Rate limited. Wait a moment and try again.");
    throw new Error(err.error?.message || `API error (${res.status})`);
  }

  return await res.json();
}

function parseAndValidateGroups(apiResponse, allTabIds) {
  const text = apiResponse.content?.[0]?.text;
  if (!text) throw new Error("Empty response from Claude.");

  let parsed;
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Claude returned invalid JSON. Try again.");
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
