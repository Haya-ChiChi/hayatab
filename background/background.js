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

  const tabs = await browser.tabs.query({ currentWindow: true });
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
  const { id: windowId } = await browser.windows.getCurrent();

  for (const group of groups) {
    const groupId = await browser.tabs.group({
      tabIds: group.tabIds,
      createProperties: { windowId },
    });

    if (browser.tabGroups?.update) {
      await browser.tabGroups.update(groupId, {
        title: group.name,
        color: group.color,
      });
    }
  }

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

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

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

  for (const group of parsed.groups) {
    // Validate color
    if (!validColors.has(group.color)) group.color = "grey";
    // Filter out invalid tab IDs
    group.tabIds = group.tabIds.filter((id) => allTabIdSet.has(id));
  }

  // Remove empty groups
  parsed.groups = parsed.groups.filter((g) => g.tabIds.length > 0);

  // Find orphaned tabs
  const assignedIds = new Set(parsed.groups.flatMap((g) => g.tabIds));
  const missingIds = allTabIds.filter((id) => !assignedIds.has(id));
  if (missingIds.length > 0) {
    parsed.groups.push({ name: "Other", color: "grey", tabIds: missingIds });
  }

  return parsed.groups;
}
