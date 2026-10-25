const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Like Firefox, permissions.request() only works synchronously inside an event handler
let handlingInput = false;

// Minimal fake DOM: just what options.js calls.
class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.parent = null;
    this.attrs = {};
    this.listeners = {};
    this.style = {};
    this.dataset = {};
    this.className = "";
    this.textContent = "";
    this.value = "";
    this.id = "";
    this.classList = {
      add: (c) => (this.className = [...this.className.split(" ").filter(Boolean), c].join(" ")),
      remove: (c) => (this.className = this.className.split(" ").filter((x) => x && x !== c).join(" ")),
    };
  }
  get firstChild() { return this.children[0] || null; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  insertBefore(c, ref) {
    c.parent = this;
    this.children.splice(ref ? this.children.indexOf(ref) : this.children.length, 0, c);
    return c;
  }
  replaceChildren() { this.children = []; this._sel = undefined; }
  remove() { this.parent?.children.splice(this.parent.children.indexOf(this), 1); }
  focus() {}
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  dispatchEvent(ev) {
    handlingInput = true;
    try { return Promise.all((this.listeners[ev.type] || []).map((fn) => fn(ev))); } finally { handlingInput = false; }
  }
}

// Real <select>.value: selected option's value, first option by default, "" if none.
class Select extends Element {
  get value() {
    if (this._sel === null) return "";
    return (this._sel && this.children.includes(this._sel) ? this._sel : this.children[0])?.value ?? "";
  }
  set value(v) { this._sel = this.children.find((o) => o.value === v) || null; }
}

function find(el, id) {
  if (el.id === id) return el;
  for (const c of el.children) {
    const r = find(c, id);
    if (r) return r;
  }
  return null;
}

function makeEnv(store, { grant = true } = {}) {
  const fetchCalls = [];
  const permCalls = { request: [], remove: [] };
  const root = new Element("body");
  for (const id of ["provider-tabs", "provider-config", "cooldown", "btn-save", "status"]) {
    const el = id === "cooldown" ? new Select("select") : new Element("div");
    el.id = id;
    root.appendChild(el);
  }
  const document = {
    createElement: (t) => (t === "select" ? new Select(t) : new Element(t)),
    createElementNS: (ns, t) => new Element(t),
    getElementById: (id) => find(root, id),
  };
  const browser = {
    storage: {
      local: {
        get: async (keys) => Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, store[k]])),
        set: async (obj) => Object.assign(store, obj),
      },
    },
    permissions: {
      request: async (p) => {
        if (!handlingInput) throw new Error("permissions.request may only be called from a user input handler");
        permCalls.request.push(p);
        return grant;
      },
      contains: async () => false,
      remove: async (p) => (permCalls.remove.push(p), true),
    },
  };
  const fetch = async (url, opts) => (fetchCalls.push({ url, opts }), { ok: true, status: 200, json: async () => ({ data: [] }) });
  const ctx = vm.createContext({ document, browser, fetch, Event, URL, console, setTimeout: () => 0 });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../options/options.js"), "utf8"), ctx);
  const ready = new Promise((r) => setImmediate(r));
  const $ = (id) => document.getElementById(id);
  const run = (code) => vm.runInContext(code, ctx);
  const save = () => $("btn-save").dispatchEvent(new Event("click"));
  return { ctx, ready, $, run, save, fetchCalls, permCalls };
}

const CUSTOM_STORE = () => ({
  provider: "custom",
  customBaseUrl: "https://openrouter.ai/api/v1",
  model_custom: "deepseek/deepseek-chat",
});

test("model refresh: custom provider never fetches (key must not leak to OpenAI)", async () => {
  const env = makeEnv({ ...CUSTOM_STORE(), apiKey_custom: "sk-secret" });
  await env.ready;
  await assert.rejects(env.run('fetchAvailableModels("custom")'), /not available/);
  assert.strictEqual(env.fetchCalls.length, 0);
});

test("refresh button: absent on Custom API tab, present on OpenAI tab", async () => {
  const env = makeEnv(CUSTOM_STORE());
  await env.ready;
  const hasRefresh = () => {
    const walk = (e) => e.className.split(" ").includes("btn-refresh") || e.children.some(walk);
    return walk(env.$("provider-config"));
  };
  assert.strictEqual(hasRefresh(), false);
  env.run("activeProvider = 'openai'; renderProviderConfig()");
  assert.strictEqual(hasRefresh(), true);
});

test("custom model: saved value round-trips through load and save", async () => {
  const store = CUSTOM_STORE();
  const env = makeEnv(store);
  await env.ready;
  assert.strictEqual(env.$("model").value, "custom");
  assert.strictEqual(env.$("custom-model").value, "deepseek/deepseek-chat");
  env.$("custom-model").value = "deepseek/deepseek-r1";
  await env.save();
  assert.strictEqual(store.model_custom, "deepseek/deepseek-r1");
});

test("custom save: requests exactly the base URL origin", async () => {
  const store = CUSTOM_STORE();
  const env = makeEnv(store);
  await env.ready;
  await env.save();
  assert.strictEqual(JSON.stringify(env.permCalls.request), JSON.stringify([{ origins: ["https://openrouter.ai/*"] }]));
  assert.strictEqual(env.permCalls.remove.length, 0);
});

test("custom save: denied permission writes nothing and shows an error", async () => {
  const store = CUSTOM_STORE();
  const before = JSON.stringify(store);
  const env = makeEnv(store, { grant: false });
  await env.ready;
  env.$("custom-model").value = "other";
  await env.save();
  assert.strictEqual(JSON.stringify(store), before);
  assert.match(env.$("status").className, /error/);
});

test("custom save: moving to a new endpoint releases the old origin", async () => {
  const store = { ...CUSTOM_STORE(), customBaseUrl: "https://api.deepseek.com/v1" };
  const env = makeEnv(store);
  await env.ready;
  env.$("custom-base-url").value = "https://openrouter.ai/api/v1";
  await env.save();
  assert.strictEqual(JSON.stringify(env.permCalls.remove), JSON.stringify([{ origins: ["https://api.deepseek.com/*"] }]));
  assert.strictEqual(store.customBaseUrl, "https://openrouter.ai/api/v1");
});

test("custom save: localhost base URL saves without requesting a permission", async () => {
  const store = { ...CUSTOM_STORE(), customBaseUrl: undefined };
  const env = makeEnv(store);
  await env.ready;
  env.$("custom-base-url").value = "http://localhost:1234/v1";
  await env.save();
  assert.strictEqual(env.permCalls.request.length, 0);
  assert.strictEqual(store.customBaseUrl, "http://localhost:1234/v1");
});

test("z.ai save: requests api.z.ai inside the click and saves the key", async () => {
  const store = { provider: "zai" };
  const env = makeEnv(store);
  await env.ready;
  env.$("api-key").value = "zai.key";
  await env.save();
  assert.strictEqual(JSON.stringify(env.permCalls.request), JSON.stringify([{ origins: ["https://api.z.ai/*"] }]));
  assert.strictEqual(store.apiKey_zai, "zai.key");
});

test("z.ai refresh: requests api.z.ai inside the click, then lists models", async () => {
  const env = makeEnv({ provider: "zai", apiKey_zai: "zai.key" });
  await env.ready;
  const find = (e) => (e.className.split(" ").includes("btn-refresh") ? e : e.children.map(find).find(Boolean));
  await find(env.$("provider-config")).dispatchEvent(new Event("click"));
  assert.strictEqual(env.permCalls.request.length, 1);
  assert.strictEqual(env.fetchCalls[0]?.url, "https://api.z.ai/api/paas/v4/models");
});

test("extractModelIds: zai keeps glm chat models only, sorted and deduped", async () => {
  const env = makeEnv({});
  const ids = env.run(`extractModelIds("zai", { data: [
    { id: "glm-5.3" }, { id: "gpt-x" }, { id: "glm-4.7" }, { id: "glm-image-1" }, { id: "glm-5.3" }, { id: 7 },
  ] })`);
  assert.deepStrictEqual([...ids], ["glm-4.7", "glm-5.3"]);
});

test("extractModelIds: openai drops embedding/whisper/tts/dall-e, sorted and deduped", async () => {
  const env = makeEnv({});
  const ids = env.run(`extractModelIds("openai", { data: [
    { id: "gpt-b" }, { id: "text-embedding-3" }, { id: "whisper-1" }, { id: "tts-1" },
    { id: "dall-e-3" }, { id: "gpt-a" }, { id: "gpt-b" },
  ] })`);
  assert.deepStrictEqual([...ids], ["gpt-a", "gpt-b"]);
});
