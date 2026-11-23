const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Auto-sort's decisions, run on the real background.js in a context with a fake browser and a fake clock.
const plain = (x) => JSON.parse(JSON.stringify(x));
const flush = () => new Promise((r) => setImmediate(r));

function load({ tabs = [], groups = [], settings = {}, failGroupFor = [], sessionValues = {}, sessions = true, tabGroups = true } = {}) {
  const listeners = {};
  const on = (name) => ({ addListener: (fn) => (listeners[name] = fn) });
  const calls = { group: [], update: [], fetch: [], warn: [], setTabValue: [] };
  let nextGroupId = 900;
  const state = { tabs: tabs.map((t) => ({ ...t })), groups: groups.map((g) => ({ ...g })) };
  const ctx = {
    console: { warn: (...a) => calls.warn.push(a.map(String).join(" ")), log() {}, error() {} },
    setTimeout, clearTimeout, URL,
    fetch: async (url, init) => {
      calls.fetch.push({ url, body: JSON.parse(init.body) });
      return ctx.__response();
    },
    __response: () => ({ ok: false, status: 500, text: async () => "", json: async () => ({}) }),
    browser: {
      runtime: { onMessage: on("onMessage"), onInstalled: on("onInstalled"), getPlatformInfo: async () => ({ os: "linux" }), getURL: () => "moz-extension://x/" },
      storage: { local: { get: async () => ({ ...settings }), set: async () => {}, remove: async () => {} }, onChanged: on("storageChanged") },
      tabs: {
        onUpdated: on("tabUpdated"), onRemoved: on("tabRemoved"),
        query: async (q) => state.tabs.filter((t) => q.windowId === undefined || t.windowId === q.windowId),
        group: async ({ tabIds, groupId, createProperties }) => {
          if (tabIds.some((id) => failGroupFor.includes(id))) throw new Error("gone");
          const gid = groupId ?? nextGroupId++;
          calls.group.push(plain({ tabIds, groupId: groupId ?? null, windowId: createProperties?.windowId ?? null }));
          return gid;
        },
      },
      tabGroups: {
        query: async (q) => state.groups.filter((g) => g.windowId === q.windowId),
        update: async (id, props) => calls.update.push(plain({ id, ...props })),
      },
      // Firefox leaves the sessions API out until its optional permission is granted.
      sessions: {
        getTabValue: async (tabId, key) => sessionValues[tabId]?.[key],
        setTabValue: async (tabId, key, value) => calls.setTabValue.push([tabId, key, value]),
      },
    },
  };
  if (!sessions) delete ctx.browser.sessions;
  if (!tabGroups) delete ctx.browser.tabGroups;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../background/background.js"), "utf8"), ctx);
  return { ctx, listeners, calls, state };
}

const web = (id, title, extra = {}) => ({ id, windowId: 1, title, url: "https://example.com/" + id, groupId: -1, pinned: false, hidden: false, incognito: false, ...extra });

function fakeClock() {
  let t = 0;
  let timers = [];
  let seq = 0;
  return {
    now: () => t,
    setTimer: (fn, ms) => { const id = ++seq; timers.push({ id, at: t + ms, fn }); return id; },
    clearTimer: (id) => { timers = timers.filter((x) => x.id !== id); },
    async advance(ms) {
      const end = t + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > end) break;
        timers.shift();
        t = next.at;
        next.fn();
        await flush();
      }
      t = end;
      await flush();
    },
  };
}

test("candidates: only ungrouped, unpinned, visible, non-private web tabs that are not hands-off", () => {
  const { ctx } = load();
  const hands = new Set([7]);
  const ok = web(1, "a");
  assert.strictEqual(ctx.isAutoCandidate(ok, hands), true);
  assert.strictEqual(ctx.isAutoCandidate({ ...ok, groupId: undefined }, hands), true);
  for (const bad of [{ groupId: 3 }, { pinned: true }, { hidden: true }, { incognito: true }, { url: "about:newtab" }, { url: "moz-extension://x/popup.html" }, { url: "file:///C:/a.txt" }, { id: 7 }]) {
    assert.strictEqual(ctx.isAutoCandidate({ ...ok, ...bad }, hands), false, JSON.stringify(bad));
  }
});

test("the message escapes tab and group text, groups first", () => {
  const { ctx } = load();
  const msg = ctx.buildAutoMessage([web(1, '</title><tab id="9">x')], [{ id: 5, title: "Work & <b>", sample: ["Inbox"] }]);
  assert.ok(msg.indexOf("<groups>") < msg.indexOf("<tabs>"));
  assert.ok(msg.includes("&lt;/title&gt;&lt;tab id=&quot;9&quot;&gt;x"));
  assert.ok(msg.includes("Work &amp; &lt;b&gt;"));
  assert.ok(!msg.includes('<tab id="9">'));
});

test("assignments: join, create, duplicates, unknown tabs and groups, ungrouped, lone new groups", () => {
  const { ctx } = load();
  const text = JSON.stringify({
    assign: [
      { tabId: 1, groupId: 5 },
      { tabId: 2, newGroup: "Recipes" },
      { tabId: 3, newGroup: "Recipes" },
      { tabId: 2, groupId: 5 },
      { tabId: 99, groupId: 5 },
      { tabId: 4, groupId: 999 },
      { tabId: 6, ungrouped: true },
      { tabId: 8, newGroup: "Lonely" },
    ],
    newGroups: [{ name: "Recipes!", color: "green" }, { name: "Lonely", color: "blue" }],
  });
  const r = plain(ctx.parseAutoAssignments("Sure:\n" + text, [1, 2, 3, 4, 6, 8], [5]));
  assert.deepStrictEqual(r.join, [{ groupId: 5, tabIds: [1] }]);
  assert.deepStrictEqual(r.create, [{ name: "Recipes", color: "green", tabIds: [2, 3] }]);
});

test("assignments: invalid JSON gives nothing to do rather than a throw", () => {
  const { ctx } = load();
  assert.deepStrictEqual(plain(ctx.parseAutoAssignments("no json here", [1], [])), { join: [], create: [] });
});

test("scheduler: a burst of loads in one window is one run, 4 s after the last", async () => {
  const { ctx } = load();
  const clock = fakeClock();
  const runs = [];
  const s = ctx.createAutoScheduler({ ...clock, run: async (w) => runs.push([w, clock.now()]) });
  for (let i = 0; i < 20; i++) { s.note(1); await clock.advance(200); }
  await clock.advance(10_000);
  assert.deepStrictEqual(runs, [[1, 3800 + 4000]], "one run, 4 s after the 20th load at 3.8 s");
});

test("scheduler: runs are 15 s apart, and none starts while one is in flight", async () => {
  const { ctx } = load();
  const clock = fakeClock();
  const runs = [];
  let release;
  const s = ctx.createAutoScheduler({ ...clock, run: (w) => { runs.push([w, clock.now()]); return new Promise((r) => (release = r)); } });
  s.note(1);
  await clock.advance(4000);
  s.note(2);
  await clock.advance(30_000);
  assert.deepStrictEqual(runs, [[1, 4000]], "window 2 waits for window 1's call");
  release();
  await clock.advance(0);
  assert.deepStrictEqual(runs.map((r) => r[0]), [1, 2]);
  assert.ok(runs[1][1] - runs[0][1] >= 15_000);
});

test("scheduler: a second window that settles soon after a quick run still waits out the gap", async () => {
  const { ctx } = load();
  const clock = fakeClock();
  const runs = [];
  const s = ctx.createAutoScheduler({ ...clock, run: async (w) => runs.push([w, clock.now()]) });
  s.note(1);
  await clock.advance(5000);
  s.note(2);
  await clock.advance(30_000);
  assert.deepStrictEqual(runs, [[1, 4000], [2, 19_000]]);
});

test("a tab taken out of a group is hands-off for good, and leaves that list when closed", () => {
  const { ctx, listeners } = load();
  const tab = web(4, "x");
  listeners.tabUpdated(4, { groupId: -1 }, tab);
  assert.strictEqual(ctx.isAutoCandidate(tab, ctx.autoHandsOff), false);
  listeners.tabRemoved(4, {});
  assert.strictEqual(ctx.autoHandsOff.has(4), false);
});

test("applying re-reads the window: closed, grouped or pinned tabs are skipped, and nothing throws", async () => {
  const tabs = [web(1, "a"), web(2, "b", { groupId: 7 }), web(3, "c", { pinned: true }), web(5, "e")];
  const { ctx, calls } = load({ tabs, groups: [{ id: 5, windowId: 1, title: "Work" }] });
  await ctx.applyAutoAssignments(1, { join: [{ groupId: 5, tabIds: [1, 2, 4] }], create: [{ name: "New", color: "red", tabIds: [3, 5, 6] }] });
  assert.deepStrictEqual(calls.group, [{ tabIds: [1], groupId: 5, windowId: null }]);
  assert.deepStrictEqual(calls.update, [], "a new group left with one tab is not made");
});

test("applying: a group that vanished since the call is not joined", async () => {
  const { ctx, calls } = load({ tabs: [web(1, "a"), web(2, "b")], groups: [] });
  await ctx.applyAutoAssignments(1, { join: [{ groupId: 5, tabIds: [1, 2] }], create: [] });
  assert.deepStrictEqual(calls.group, []);
});

test("a run with no API key logs once and calls nothing", async () => {
  const { ctx, calls } = load({ tabs: [web(1, "a"), web(2, "b")], settings: { autoSort: true, provider: "claude" } });
  await ctx.runAutoSort(1);
  assert.strictEqual(calls.fetch.length, 0);
  assert.strictEqual(calls.group.length, 0);
  assert.strictEqual(calls.warn.length, 1);
});

test("a 401 from the provider logs once and groups nothing", async () => {
  const { ctx, calls } = load({ tabs: [web(1, "a"), web(2, "b")], settings: { autoSort: true, provider: "claude", apiKey_claude: "k" } });
  ctx.__response = () => ({ ok: false, status: 401, text: async () => "", json: async () => ({}) });
  await ctx.runAutoSort(1);
  assert.strictEqual(calls.fetch.length, 1);
  assert.strictEqual(calls.group.length, 0);
  assert.strictEqual(calls.warn.length, 1);
});

test("a run does nothing while auto-sort is off", async () => {
  const { ctx, calls } = load({ tabs: [web(1, "a"), web(2, "b")], settings: { provider: "claude", apiKey_claude: "k" } });
  await ctx.runAutoSort(1);
  assert.strictEqual(calls.fetch.length, 0);
});

test("a lone ungrouped tab in a window with no groups waits for company", async () => {
  const { ctx, calls } = load({ tabs: [web(1, "a")], settings: { autoSort: true, provider: "claude", apiKey_claude: "k" } });
  await ctx.runAutoSort(1);
  assert.strictEqual(calls.fetch.length, 0);
});

test("a run end to end: Claude's answer joins and creates groups in that window", async () => {
  const tabs = [web(1, "Pasta recipe"), web(2, "Ramen recipe"), web(3, "PR review"), web(10, "Inbox", { groupId: 5 })];
  const { ctx, calls } = load({ tabs, groups: [{ id: 5, windowId: 1, title: "Work" }], settings: { autoSort: true, provider: "claude", apiKey_claude: "k" } });
  const answer = { assign: [{ tabId: 1, newGroup: "Cooking" }, { tabId: 2, newGroup: "Cooking" }, { tabId: 3, groupId: 5 }], newGroups: [{ name: "Cooking", color: "orange" }] };
  ctx.__response = () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: JSON.stringify(answer) }] }) });
  await ctx.runAutoSort(1);
  assert.strictEqual(calls.fetch.length, 1);
  assert.ok(calls.fetch[0].body.system.includes("existing group"));
  assert.ok(calls.fetch[0].body.messages[0].content.includes("Inbox"), "the group's sample titles go with it");
  assert.deepStrictEqual(calls.group, [{ tabIds: [3], groupId: 5, windowId: null }, { tabIds: [1, 2], groupId: null, windowId: 1 }]);
  assert.deepStrictEqual(calls.update, [{ id: 900, title: "Cooking", color: "orange" }]);
});

test("a tab taken out of a group is still hands-off after a restart: the mark is kept with the tab's session data", async () => {
  const before = load();
  before.listeners.tabUpdated(4, { groupId: -1 }, web(4, "Bank statement"));
  assert.deepStrictEqual(plain(before.calls.setTabValue), [[4, "hayatabHandsOff", true]]);
  // After a restart the tab has a new id; Firefox restores its session values.
  const tabs = [web(14, "Bank statement"), web(15, "Shoes"), web(16, "Boots")];
  const after = load({ tabs, sessionValues: { 14: { hayatabHandsOff: true } }, settings: { autoSort: true, provider: "claude", apiKey_claude: "k" } });
  after.ctx.__response = () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: '{"assign":[]}' }] }) });
  await after.ctx.runAutoSort(1);
  assert.strictEqual(after.calls.fetch.length, 1);
  const sent = after.calls.fetch[0].body.messages[0].content;
  assert.ok(sent.includes("Shoes") && !sent.includes("Bank statement"));
});

test("without the sessions permission, a tab taken out of a group is still hands-off for this session", () => {
  const { ctx, listeners, calls } = load({ sessions: false });
  listeners.tabUpdated(4, { groupId: -1 }, web(4, "x"));
  assert.strictEqual(ctx.autoHandsOff.has(4), true);
  assert.strictEqual(calls.setTabValue.length, 0);
});

test("without the tab groups API (Firefox for Android), auto-sort does nothing and logs nothing", async () => {
  const { ctx, calls, listeners } = load({ tabGroups: false, tabs: [web(1, "a"), web(2, "b")], settings: { autoSort: true, provider: "claude", apiKey_claude: "k" } });
  listeners.tabUpdated(1, { status: "complete" }, web(1, "a"));
  await ctx.runAutoSort(1);
  assert.strictEqual(calls.fetch.length, 0);
  assert.strictEqual(calls.warn.length, 0);
});
