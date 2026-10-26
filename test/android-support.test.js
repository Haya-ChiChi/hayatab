const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const GROUPS_JSON = JSON.stringify({
  groups: [
    { name: "Work", color: "blue", tabIds: [2, 1] },
    { name: "Video", color: "red", tabIds: [3] },
  ],
});

// Tabs as Firefox for Android would report them: the user's tabs in window 1
// (one pinned, one hidden), plus the extension popup itself as a tab in its
// own window (window 2).
const ANDROID_TABS = [
  { id: 1, title: "Example", url: "https://example.com", windowId: 1, active: true, pinned: false, favIconUrl: "" },
  { id: 2, title: "GitHub", url: "https://github.com", windowId: 1, active: false, pinned: false, favIconUrl: "" },
  { id: 3, title: "YouTube", url: "https://youtube.com", windowId: 1, active: false, pinned: false, favIconUrl: "" },
  { id: 9, title: "Mail", url: "https://mail.example.com", windowId: 1, active: false, pinned: true, favIconUrl: "" },
  { id: 10, title: "Hidden", url: "https://hidden.example.com", windowId: 1, active: false, hidden: true, favIconUrl: "" },
  { id: 99, title: "Hayatab", url: "moz-extension://uuid/popup/popup.html", windowId: 2, active: true, pinned: false, favIconUrl: "" },
];

function makeEnv({ android = true, groupsApi = false } = {}) {
  const store = { provider: "claude", apiKey_claude: "sk-ant-1" };
  const moves = [];
  const grouped = [];
  let listener;
  const tabsApi = {
    query: async (queryInfo) => {
      if (android && ("hidden" in queryInfo || "pinned" in queryInfo)) {
        throw new TypeError(
          `Type error for parameter queryInfo (Unexpected property "${"hidden" in queryInfo ? "hidden" : "pinned"}") for tabs.query.`
        );
      }
      return JSON.parse(JSON.stringify(ANDROID_TABS));
    },
    move: async (id, { index }) => { moves.push([id, index]); },
  };
  if (groupsApi) {
    tabsApi.group = async ({ tabIds }) => { grouped.push(tabIds); return 7; };
  }
  const browser = {
    runtime: {
      onMessage: { addListener: (fn) => (listener = fn) },
      onInstalled: { addListener() {} },
      getURL: (p) => `moz-extension://uuid/${p}`,
    },
    storage: {
      local: {
        get: async (keys) => Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, store[k]])),
        set: async (obj) => Object.assign(store, obj),
        remove: async () => {},
      },
    },
    tabs: tabsApi,
    tabGroups: groupsApi ? { update: async () => {} } : undefined,
    windows: {
      // Android: the windows API is not fully available
      getCurrent: android ? async () => { throw new Error("windows.getCurrent not available"); } : async () => ({ id: 1 }),
    },
  };
  const fetchMock = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: "text", text: GROUPS_JSON }] }),
    text: async () => "",
  });
  const ctx = { browser, fetch: fetchMock, console, URL };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../background/background.js"), "utf8"), ctx);
  const send = (msg) => new Promise((resolve) => listener(msg, null, resolve));
  return { send, moves, grouped };
}

test("android: analyze succeeds without hidden/pinned filters and sees the user's window", async () => {
  const { send } = makeEnv({ android: true });
  const res = await send({ action: "analyzeTabs" });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  // Exactly the three real tabs in window 1: pinned, hidden and popup tabs excluded
  const seen = res.groups.flatMap((g) => g.tabIds).sort();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(seen)), [1, 2, 3]);
});

test("android: apply sorts tabs by group when the groups API is missing", async () => {
  const { send, moves } = makeEnv({ android: true, groupsApi: false });
  const analyzed = await send({ action: "analyzeTabs" });
  assert.strictEqual(analyzed.ok, true);
  const applied = await send({ action: "applyGroups", groups: analyzed.groups });
  assert.strictEqual(applied.ok, true);
  assert.strictEqual(applied.sortedOnly, true);
  // Group order preserved, starting after the one pinned tab in window 1
  assert.deepStrictEqual(moves, [[2, 1], [1, 2], [3, 3]]);
});

test("android: pending groups survive a missing windows API", async () => {
  const { send } = makeEnv({ android: true });
  await send({ action: "analyzeTabs" });
  const pending = await send({ action: "getPendingGroups" });
  assert.strictEqual(pending.ok, true);
  assert.strictEqual(pending.groups.length, 2);
});

test("desktop: native grouping is still used when the groups API exists", async () => {
  const { send, moves, grouped } = makeEnv({ android: false, groupsApi: true });
  const analyzed = await send({ action: "analyzeTabs" });
  assert.strictEqual(analyzed.ok, true);
  const applied = await send({ action: "applyGroups", groups: analyzed.groups });
  assert.strictEqual(applied.ok, true);
  assert.strictEqual(applied.sortedOnly, undefined);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(grouped)), [[2, 1], [3]]);
  assert.deepStrictEqual(moves, []);
});
