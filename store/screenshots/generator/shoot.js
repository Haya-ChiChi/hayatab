// Renders the AMO screenshots from the real popup/options pages with a mocked
// `browser` API (mock.js) and sample tabs. Needs Playwright with Chromium.
// Usage (from the repo root): node store/screenshots/generator/shoot.js store/screenshots
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUT = process.argv[2];
const DSF = Number(process.argv[3] || 1);
const BASE = "http://hayatab.test";
const REPO = path.resolve(__dirname, "../../..");
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ttf": "font/ttf", ".woff": "font/woff" };
const mock = fs.readFileSync(path.join(__dirname, "mock.js"), "utf8");

const shots = [
  {
    file: "1-suggested-groups.png", theme: "dark", page: "popup/popup.html", s: "popup", width: 380, scale: 1.4,
    h: "Too many tabs?<br><em>Sorted in one click.</em>",
    sub: "Hayatab reads your tab titles and suggests labeled groups. Look them over, then apply them as native Firefox tab groups.",
    act: async (f) => { await f.click("#btn-analyze"); await f.waitForSelector("#view-results:not(.hidden) .group-card"); },
  },
  {
    file: "2-rename-light.png", theme: "light", page: "popup/popup.html", s: "popup", width: 380, scale: 1.4,
    h: "Rename any group <em>before you apply.</em>",
    sub: "Every suggestion is editable. Hayatab follows your Firefox theme, light or dark.",
    act: async (f) => {
      await f.click("#btn-analyze");
      await f.waitForSelector("#view-results:not(.hidden) .group-card");
      const input = f.locator(".group-name-input").first();
      await input.fill("Lisbon in March");
      await input.focus();
    },
  },
  {
    file: "3-providers.png", theme: "dark", page: "options/options.html", s: "claude", width: 420, scale: 1.3,
    h: "Your AI, <em>your key.</em>",
    sub: "Claude, OpenAI, Gemini, Z.AI, Ollama, or any OpenAI-compatible API. Load the latest models straight from your account.",
  },
  {
    file: "4-local-ollama.png", theme: "light", page: "options/options.html", s: "ollama", width: 420, scale: 1.3,
    h: "Or keep it all<br><em>on your machine.</em>",
    sub: "Run a model locally with Ollama and no tab data leaves your computer. No telemetry, no tracking.",
  },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const shot of shots) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: DSF, colorScheme: shot.theme });
    await ctx.addInitScript(mock);
    // Serve the workspace from disk in-process (no listening server)
    await ctx.route("**/*", async (route) => {
      const u = new URL(route.request().url());
      if (u.origin !== BASE) return route.abort();
      const rel = decodeURIComponent(u.pathname);
      const root = rel.startsWith("/ext/") ? REPO : __dirname;
      const file = path.join(root, rel.startsWith("/ext/") ? rel.slice(4) : rel);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
      route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.error("pageerror", shot.file, e.message));
    await page.goto(`${BASE}/frame.html`);
    await page.evaluate(({ shot }) => {
      document.body.classList.toggle("light", shot.theme === "light");
      document.getElementById("h").innerHTML = shot.h;
      document.getElementById("sub").textContent = shot.sub;
      const f = document.getElementById("f");
      f.style.width = shot.width + "px";
      f.style.height = "400px";
      f.src = `/ext/${shot.page}#s=${shot.s}`;
    }, { shot: { ...shot, act: undefined } });
    const handle = await page.waitForSelector("#f");
    let frame = await handle.contentFrame();
    await frame.waitForLoadState("load");
    await frame.waitForFunction(() => !!document.querySelector(".view:not(.hidden), .provider-tab"));
    if (shot.act) await shot.act(frame);
    await page.waitForTimeout(900); // let entry animations finish
    await page.evaluate(async ({ shot }) => {
      await document.fonts.ready;
      const f = document.getElementById("f");
      const doc = f.contentDocument;
      const h = shot.page.startsWith("popup") ? doc.body.offsetHeight : doc.documentElement.scrollHeight;
      f.style.height = h + "px";
      const scale = Math.min(shot.scale, 720 / h, 640 / shot.width);
      const panel = document.getElementById("panel");
      panel.style.transform = `scale(${scale})`;
    }, { shot: { ...shot, act: undefined } });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, shot.file) });
    console.log("wrote", shot.file);
    await ctx.close();
  }
  await browser.close();
})();
