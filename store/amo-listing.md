# Firefox Add-ons listing

Text for the Hayatab page on addons.mozilla.org. Paste each section into the matching field in the Developer Hub (Edit Product Page / version release notes). Keep this file in sync with the live page.

## Name

```
Hayatab – One-Click Tab Groups
```

## Summary

Limit: 250 characters.

```
Sorts your open tabs into labeled groups with AI, in one click. Use Claude, OpenAI, Gemini, Z.AI, any OpenAI-compatible API, or a local Ollama model. Uses Firefox's native tab groups.
```

## Description

AMO escapes raw HTML (`<strong>` shows up literally) but supports a limited set of Markdown in the description: bold, italic, links, abbreviations, blockquotes, code and lists, but no headings ([Extension Workshop: Make use of Markdown](https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/#make-use-of-markdown)). Leave a blank line before a list so it renders as one. AMO turns "Z.AI" into a link to z.ai automatically.

```
Too many tabs open? Hayatab uses AI to sort them into labeled groups, so you can see what's going on at a glance.

Click **Analyze Tabs** and Hayatab suggests groups like "Work", "YouTube" or "Shopping". Look over the suggestions, then click **Apply** to create them as native Firefox tab groups in one go.

**Supported AI providers:**

- Claude (Anthropic)
- OpenAI
- Gemini (Google)
- Z.AI
- Ollama: run a model on your own computer, with no data leaving it
- Custom API: any OpenAI-compatible service, such as OpenRouter, DeepSeek, Groq, Mistral or a local LM Studio server

Bring your own API key. The model list can be loaded straight from your provider account, so newly released models show up without waiting for an extension update.

**Firefox for Android (experimental):** Android has no tab groups, so Hayatab sorts your tabs by group instead. It hasn't been tested on a real device yet, so please [report anything that doesn't work on GitHub](https://github.com/Haya-ChiChi/hayatab/issues).

**Cost per analysis:** a fraction of a cent with cloud providers. Ollama and other local models are free.

**No telemetry. No tracking.** Only tab titles and URLs are sent, only to the provider you pick, and only when you click Analyze Tabs. API keys are stored locally in Firefox and never shared. Tab titles are treated as untrusted data, so a page can't hijack the AI through its title.
```

## Categories and tags

**Categories:** Tabs. Leave Privacy & Security unticked: people browsing that category expect blockers and anti-trackers, and Hayatab sends tab titles to a cloud AI by default.

**Tags:** `privacy` only. AMO offers a fixed tag list with nothing tab- or AI-related, so `privacy` (no telemetry, fully local option with Ollama) is the one that fits. Don't use `search`, `shopping`, `streaming` or `user scripts`.

## Screenshots

Upload the PNGs in `store/screenshots/` (1280×800, the size AMO recommends) in this order, and delete the four old ones. They show the real popup and settings pages with sample tabs; regenerate them after UI changes with `node store/screenshots/generator/shoot.js store/screenshots`.

| File | Caption |
|------|---------|
| `1-suggested-groups.png` | One click turns a messy window into labeled groups. |
| `2-rename-light.png` | Rename any suggested group before applying. Light and dark themes. |
| `3-providers.png` | Use Claude, OpenAI, Gemini, Z.AI, Ollama or any OpenAI-compatible API with your own key. |
| `4-local-ollama.png` | Run fully local with Ollama: no tab data leaves your computer. |

The old screenshot of Firefox's own tab strip with groups applied can't be generated here (it needs a real Firefox window). Retake it if you want one; the extension UI shots above replace the other three.

## Release notes: 1.2.1

```
- Better group colours: the leftover "Other" group is always grey, and no other group uses grey.
- Clearer example group names in the AI instructions (topics like "Research" or "Travel Plans" rather than site names), so groups follow what your tabs are about rather than which site they're on.
```

## Notes to reviewer: 1.2.1

```
Small update to 1.2.0. The only code change is the system prompt sent to the AI provider (background/background.js, SYSTEM_PROMPT): topic-based example group names, and the "Other" group is always grey while other groups use the eight non-grey colours. No new permissions, no change to what data is sent or when.

No build step, bundler, minifier or transpiler: every file in the package is hand-written source, identical to the public repository at https://github.com/Haya-ChiChi/hayatab. No source code upload is needed. Testing instructions are the same as for 1.2.0 (a local Ollama server is the quickest provider to test with).
```

## Release notes: 1.2.0

As submitted:

```
- New: Firefox for Android support (experimental, Firefox for Android 142 or newer). Android has no tab groups, so tabs are sorted by group instead.
- Better group suggestions: names follow the language of your tabs, avoid characters that would be stripped out, and leftover tabs go into a single "Other" group.
- Privacy policy clarified: the model-list refresh in settings contacts your provider with your API key only, and Apply never sends anything.
- Bundled font licenses (SIL Open Font License) are now included.
```

**If the Release Notes box is missing** on the submit page: the listing's default locale is English (Canadian), but AMO only renders a hidden English (US) box. In the browser's Inspector, on the textarea `id_release_notes_0`, change `name` to `release_notes_en-ca` and `lang` to `en-ca`, and delete `style="display: none;"`. The box then appears and saves under the default locale.

## Notes to reviewer: 1.2.0

As submitted (visible only to AMO reviewers):

```
No build step, bundler, minifier or transpiler: every file in the package is hand-written source, identical to the public repository at https://github.com/Haya-ChiChi/hayatab (commit 3c9493a). No source code upload is needed.

What changed since 1.1.0:
- Firefox for Android support: on Android (detected with runtime.getPlatformInfo), tabs.group/tabGroups are unavailable, so "Apply" reorders tabs with tabs.move instead. Desktop code paths are unchanged.
- Updated system prompt sent to the AI provider (background/background.js, SYSTEM_PROMPT).
- gecko_android strict_min_version raised to 142.0 for data_collection_permissions support.
- Added OFL license files for the bundled DM Sans and JetBrains Mono fonts.

Testing: the extension needs an AI provider. The quickest option without an API key is a local Ollama server (http://localhost:11434, started with OLLAMA_ORIGINS=moz-extension://*). Open the options page, choose a provider, save, then click the toolbar button and "Analyze Tabs".

Network access: tab titles and URLs are sent only to the provider the user chooses, and only when they click "Analyze Tabs". The optional host permissions (api.z.ai and https://*/*) are requested at runtime, only when the user saves the Z.AI or Custom API settings; the latter requests just the single origin they entered. No telemetry or remote code.
```

## Packaging

Zip only the extension files, from the repo root at the release commit:

```
git archive --format=zip -9 -o web-ext-artifacts/hayatab-<version>.zip HEAD manifest.json background popup options icons fonts fonts.css LICENSE
```

This leaves out `store/`, `test/`, the README, the privacy policy and `logo.svg`. Check it with `npx web-ext lint --source-dir <unzipped folder>` before uploading. The version in `manifest.json` must be new: AMO never accepts the same version twice.

## Release notes: earlier versions (optional)

AMO shows no notes for older versions. If you want to fill them in:

```
1.1.0
- New providers: Z.AI and Custom API (any OpenAI-compatible endpoint).
- Load the model list straight from your provider account.
- Optional API key for Ollama.

1.0.1
- Updated to current Claude, OpenAI and Gemini models.
- Security hardening against prompt injection through tab titles and URLs.
- Clearer message when a provider is overloaded.
- Sturdier parsing of AI responses and popup improvements.
- New icon and logo.
```
