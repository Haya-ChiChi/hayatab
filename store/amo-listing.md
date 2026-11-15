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

AMO keeps line breaks as typed and allows `<strong>`, so paste this as-is.

```
Too many tabs open? Hayatab uses AI to sort them into labeled groups, so you can see what's going on at a glance.

Click <strong>Analyze Tabs</strong> and Hayatab suggests groups like "Work", "YouTube" or "Shopping". Look over the suggestions, then click <strong>Apply</strong> to create them as native Firefox tab groups in one go.

<strong>Supported AI providers:</strong>
- Claude (Anthropic)
- OpenAI
- Gemini (Google)
- Z.AI
- Ollama: run a model on your own computer, with no data leaving it
- Custom API: any OpenAI-compatible service, such as OpenRouter, DeepSeek, Groq, Mistral or a local LM Studio server

Bring your own API key. The model list can be loaded straight from your provider account, so newly released models show up without waiting for an extension update.

<strong>Firefox for Android (experimental):</strong> Android has no tab groups, so Hayatab sorts your tabs by group instead. It hasn't been tested on a real device yet, so please report anything that doesn't work on GitHub.

<strong>Cost per analysis:</strong> a fraction of a cent with cloud providers. Ollama and other local models are free.

<strong>No telemetry. No tracking.</strong> Only tab titles and URLs are sent, only to the provider you pick, and only when you click Analyze Tabs. API keys are stored locally in Firefox and never shared. Tab titles are treated as untrusted data, so a page can't hijack the AI through its title.
```

## Tags

AMO only offers a fixed tag list. Remove `search`, `shopping`, `streaming` and `user scripts`, which don't describe this extension. Keep `privacy`, and add `tab manager` (or the closest tab-related tag offered).

## Screenshots

Upload the PNGs in `store/screenshots/` (1280×800, the size AMO recommends) in this order, and delete the four old ones. They show the real popup and settings pages with sample tabs; regenerate them after UI changes with `node store/screenshots/generator/shoot.js store/screenshots`.

| File | Caption |
|------|---------|
| `1-suggested-groups.png` | One click turns a messy window into labeled groups. |
| `2-rename-light.png` | Rename any suggested group before applying. Light and dark themes. |
| `3-providers.png` | Use Claude, OpenAI, Gemini, Z.AI, Ollama or any OpenAI-compatible API with your own key. |
| `4-local-ollama.png` | Run fully local with Ollama: no tab data leaves your computer. |

The old screenshot of Firefox's own tab strip with groups applied can't be generated here (it needs a real Firefox window). Retake it if you want one; the extension UI shots above replace the other three.

## Release notes: 1.2.0

```
- New: Firefox for Android support (experimental). Android has no tab groups, so tabs are sorted by group instead.
- Better group suggestions: names follow the language of your tabs, avoid characters that would be stripped out, and leftover tabs go into a single "Other" group.
- Privacy policy clarified: the model-list refresh in settings contacts your provider with your API key only, and Apply never sends anything.
```

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
