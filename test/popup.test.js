const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// popup.js's status line, run on the real file with a stub page.
function load() {
  const el = () => ({ classList: { add() {}, remove() {} }, addEventListener() {}, style: {}, textContent: "", querySelector: () => el() });
  const ctx = {
    document: { getElementById: () => el(), querySelector: () => el(), createElement: () => el() },
    browser: { storage: { local: { get: async () => ({}) } }, runtime: { sendMessage: async () => ({}), openOptionsPage() {} } },
    console, Date,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../popup/popup.js"), "utf8"), ctx);
  return ctx;
}

test("status line: nothing yet, tabs grouped, nothing to group, and an error", () => {
  const { describeAutoStatus } = load();
  const now = 1_000_000_000;
  assert.strictEqual(describeAutoStatus(undefined, now), "Auto-sort: no runs yet");
  assert.strictEqual(describeAutoStatus({ at: now - 30_000, grouped: 3, error: null }, now), "Auto-sort: grouped 3 tabs, just now");
  assert.strictEqual(describeAutoStatus({ at: now - 5 * 60_000, grouped: 1, error: null }, now), "Auto-sort: grouped 1 tab, 5 min ago");
  assert.strictEqual(describeAutoStatus({ at: now - 5 * 60_000, grouped: 0, error: null }, now), "Auto-sort: nothing to group, 5 min ago");
  assert.strictEqual(describeAutoStatus({ at: now - 2 * 60_000, grouped: 0, error: "API key not valid." }, now), "Auto-sort failed 2 min ago: API key not valid.");
});
