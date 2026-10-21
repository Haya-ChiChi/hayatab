const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const removed = [];
let onInstalled;
const ctx = {
  browser: {
    runtime: { onMessage: { addListener() {} }, onInstalled: { addListener: (fn) => (onInstalled = fn) } },
    storage: { local: { remove: (keys) => removed.push(JSON.parse(JSON.stringify(keys))) } },
  },
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../background/background.js"), "utf8"), ctx);
const { parseAndValidateGroups } = ctx;
const parse = (text, ids) => JSON.parse(JSON.stringify(parseAndValidateGroups(text, ids)));

test("string IDs match numeric tabs", () => {
  const g = parse('{"groups":[{"name":"A","color":"blue","tabIds":["1","2"]}]}', [1, 2]);
  assert.deepStrictEqual(g.map((x) => [x.name, x.tabIds]), [["A", [1, 2]]]);
});

test("group without tabIds does not throw; tabs go to Other", () => {
  const g = parse('{"groups":[{"name":"A","color":"blue"}]}', [1]);
  assert.deepStrictEqual(g.map((x) => [x.name, x.tabIds]), [["Other", [1]]]);
});

test("prose and fences around JSON still parse", () => {
  const json = '{"groups":[{"name":"A","color":"red","tabIds":[1]}]}';
  assert.strictEqual(parse("Here you go:\n```json\n" + json + "\n```\nDone", [1])[0].name, "A");
});

test("unknown IDs dropped, duplicates kept once, every tab exactly once", () => {
  const g = parse('{"groups":[{"name":"A","tabIds":[1,9]},{"name":"B","tabIds":[1,2]}]}', [1, 2, 3]);
  const all = g.flatMap((x) => x.tabIds).sort();
  assert.deepStrictEqual(all, [1, 2, 3]);
  assert.deepStrictEqual(g[0].tabIds, [1]);
});

test("group names keep non-ASCII letters and strip markup", () => {
  const g = parse('{"groups":[{"name":"Développement <b>","tabIds":[1]},{"name":"ニュース","tabIds":[2]}]}', [1, 2]);
  assert.deepStrictEqual(g.map((x) => x.name), ["Développement b", "ニュース"]);
});

test("1.0.0 -> update clears saved cloud models; other cases do not", () => {
  onInstalled({ reason: "update", previousVersion: "1.0.1" });
  onInstalled({ reason: "install" });
  assert.deepStrictEqual(removed, []);
  onInstalled({ reason: "update", previousVersion: "1.0.0" });
  assert.deepStrictEqual(removed, [["model_claude", "model_openai", "model_gemini"]]);
});
