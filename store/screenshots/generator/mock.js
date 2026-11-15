// Fake WebExtension API for rendering the real popup/options pages outside Firefox.
// The scenario comes from the frame's hash: #s=<name>
(() => {
  if (!location.pathname.includes("/ext/")) return;
  const s = new URLSearchParams(location.hash.slice(1)).get("s") || "";
  const fav = (n) => `${location.origin}/fav/${n}.svg`;
  const t = (id, title, url, icon) => ({ id, title, url, favIconUrl: fav(icon) });

  const groups = [
    { name: "Lisbon Trip", color: "blue", tabs: [
      t(1, "Lisbon Travel Guide – 25 Things to Do in Lisbon", "https://example.com/lisbon", "travel"),
      t(2, "Flights Montréal → Lisbon · Sat, Mar 14", "https://example.com/flights", "flights"),
      t(3, "Alfama Guesthouse – Book Direct & Save", "https://example.com/stay", "stay"),
      t(4, "Tram 28 Route Map & Timetable", "https://example.com/tram", "tram"),
    ]},
    { name: "Web Dev", color: "purple", tabs: [
      t(5, "Array.prototype.toSorted() – JavaScript | MDN", "https://example.com/mdn", "mdn"),
      t(6, "Release 1.2.0 · Pull Request #16", "https://example.com/pr", "git"),
      t(7, "How to debounce an input in JavaScript? – Stack Overflow", "https://example.com/so", "so"),
      t(8, "CSS :has() selector | Can I use", "https://example.com/caniuse", "caniuse"),
    ]},
    { name: "Recipes", color: "orange", tabs: [
      t(9, "Weeknight Miso Ramen (30 Minutes)", "https://example.com/ramen", "ramen"),
      t(10, "Sourdough Starter: Day 1 to Day 7", "https://example.com/bread", "bread"),
      t(11, "Pasta e Ceci – One-Pot Pantry Dinner", "https://example.com/pasta", "pasta"),
    ]},
    { name: "Music & Videos", color: "red", tabs: [
      t(12, "Lo-fi Beats to Code To – 3 Hour Mix", "https://example.com/lofi", "video"),
      t(13, "Building a Mechanical Keyboard from Scratch", "https://example.com/kbd", "video"),
    ]},
    { name: "Other", color: "grey", tabs: [
      t(14, "Weather – Montréal, QC", "https://example.com/weather", "weather"),
    ]},
  ].map((g) => ({ ...g, tabIds: g.tabs.map((x) => x.id) }));

  const stores = {
    popup: { provider: "claude", apiKey_claude: "sk-ant-api03-demo-key-0000000000000000-a1b2", model_claude: "claude-haiku-5-5" },
    claude: {
      provider: "claude", apiKey_claude: "sk-ant-api03-demo-key-0000000000000000-a1b2", model_claude: "claude-haiku-5-5",
      apiKey_openai: "sk-proj-demo-key-000000000000-9f3c", cooldown: 10000,
    },
    ollama: {
      provider: "ollama", ollamaUrl: "http://localhost:11434", model_ollama: "llama3.2",
      apiKey_claude: "sk-ant-api03-demo-key-0000000000000000-a1b2", cooldown: 10000,
    },
  };
  const store = stores[s] || stores.popup;

  window.browser = {
    storage: { local: {
      get: async (keys) => {
        const out = {};
        for (const k of [].concat(keys || Object.keys(store))) if (k in store) out[k] = store[k];
        return out;
      },
      set: async () => {}, remove: async () => {},
    }},
    runtime: {
      getURL: (p) => `${location.origin}/ext/${p}`,
      openOptionsPage: () => {},
      sendMessage: async (m) => {
        if (m.action === "getTabCount") return { ok: true, count: 14 };
        if (m.action === "getPendingGroups") return { ok: true };
        if (m.action === "analyzeTabs") return { ok: true, groups: structuredClone(groups) };
        return { ok: true };
      },
    },
    permissions: { contains: async () => true, request: async () => true, remove: async () => true },
    tabs: { getCurrent: async () => null },
  };
})();
