const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const GROUPS_JSON = JSON.stringify({
  groups: [
    { name: "Dev", color: "blue", tabIds: [1] },
    { name: "Video", color: "red", tabIds: [2] },
  ],
});

// Load background.js with a stubbed browser API and mocked fetch, then drive
// it through the same runtime message the popup sends.
function makeEnv(store, { grantedOrigins = [], responder } = {}) {
  const calls = [];
  let listener;
  const browser = {
    runtime: {
      onMessage: { addListener: (fn) => (listener = fn) },
      onInstalled: { addListener() {} },
    },
    storage: {
      local: {
        get: async (keys) => Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, store[k]])),
        set: async (obj) => Object.assign(store, obj),
        remove: async () => {},
      },
    },
    tabs: {
      query: async () => [
        { id: 1, title: "GitHub - repo", url: "https://github.com/x", favIconUrl: "", windowId: 1 },
        { id: 2, title: "YouTube video", url: "https://youtube.com/watch?v=1", favIconUrl: "", windowId: 1 },
      ],
    },
    permissions: {
      contains: async ({ origins }) => origins.every((o) => grantedOrigins.includes(o)),
    },
  };
  const fetchMock = async (url, opts) => {
    calls.push({ url, headers: opts.headers, body: JSON.parse(opts.body) });
    return { ok: true, status: 200, json: async () => responder(), text: async () => "" };
  };
  const ctx = { browser, fetch: fetchMock, console, URL };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../background/background.js"), "utf8"), ctx);
  const analyze = () => new Promise((resolve) => listener({ action: "analyzeTabs" }, null, resolve));
  return { analyze, calls };
}

const openaiShape = () => ({ choices: [{ message: { content: GROUPS_JSON } }] });
const geminiShape = () => ({ candidates: [{ content: { parts: [{ text: GROUPS_JSON }] } }] });

test("custom provider: builds chat/completions URL, sends key, parses groups", async () => {
  const store = {
    provider: "custom",
    customBaseUrl: "https://openrouter.ai/api/v1",
    apiKey_custom: "sk-or-1",
    model_custom: "deepseek/deepseek-chat",
  };
  const { analyze, calls } = makeEnv(store, { grantedOrigins: ["https://openrouter.ai/*"], responder: openaiShape });
  const res = await analyze();
  assert.strictEqual(res.ok, true);
  assert.strictEqual(calls[0].url, "https://openrouter.ai/api/v1/chat/completions");
  assert.strictEqual(calls[0].headers.Authorization, "Bearer sk-or-1");
  assert.strictEqual(calls[0].body.model, "deepseek/deepseek-chat");
  assert.strictEqual(calls[0].body.max_completion_tokens, 8192);
  assert.strictEqual(res.groups.length, 2);
});

test("custom provider: without granted host permission, refuses before fetching", async () => {
  const store = {
    provider: "custom",
    customBaseUrl: "https://openrouter.ai/api/v1",
    model_custom: "deepseek/deepseek-chat",
  };
  const { analyze, calls } = makeEnv(store, { grantedOrigins: [], responder: openaiShape });
  const res = await analyze();
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /Permission for openrouter\.ai is not granted/);
  assert.strictEqual(calls.length, 0);
});

test("custom provider: plaintext http remote base URL is rejected", async () => {
  const store = {
    provider: "custom",
    customBaseUrl: "http://example.com/v1",
    model_custom: "m",
  };
  const { analyze, calls } = makeEnv(store, { grantedOrigins: ["http://example.com/*"], responder: openaiShape });
  const res = await analyze();
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /HTTPS/);
  assert.strictEqual(calls.length, 0);
});

test("custom provider: localhost http without a key works (local server)", async () => {
  const store = {
    provider: "custom",
    customBaseUrl: "http://localhost:1234/v1",
    model_custom: "local-model",
  };
  const { analyze, calls } = makeEnv(store, { grantedOrigins: ["http://localhost/*"], responder: openaiShape });
  const res = await analyze();
  assert.strictEqual(res.ok, true);
  assert.strictEqual(calls[0].url, "http://localhost:1234/v1/chat/completions");
  assert.strictEqual("Authorization" in calls[0].headers, false);
});

test("custom provider: full /chat/completions base URL is not doubled", async () => {
  const store = {
    provider: "custom",
    customBaseUrl: "https://api.deepseek.com/v1/chat/completions",
    apiKey_custom: "k",
    model_custom: "deepseek-chat",
  };
  const { analyze, calls } = makeEnv(store, { grantedOrigins: ["https://api.deepseek.com/*"], responder: openaiShape });
  const res = await analyze();
  assert.strictEqual(res.ok, true);
  assert.strictEqual(calls[0].url, "https://api.deepseek.com/v1/chat/completions");
});

test("gemini regression: default model and URL unchanged", async () => {
  const store = { provider: "gemini", apiKey_gemini: "AIzaTEST" };
  const { analyze, calls } = makeEnv(store, { responder: geminiShape });
  const res = await analyze();
  assert.strictEqual(res.ok, true);
  assert.strictEqual(
    calls[0].url,
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent"
  );
  assert.strictEqual(calls[0].headers["x-goog-api-key"], "AIzaTEST");
});
