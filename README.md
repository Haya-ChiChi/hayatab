# Hayatab

AI-powered tab grouping for Firefox. Analyzes your open tabs and organizes them into logical groups using your choice of AI provider.

## Features

- **One-click analysis** - click "Analyze Tabs" and get suggested groups instantly
- **Multiple AI providers** - Claude, OpenAI, Gemini, Z.AI, Ollama (fully local), or any OpenAI-compatible API (Custom API provider)
- **Live model discovery** - fetch the model list directly from your provider's account
- **Native tab groups** - uses Firefox's built-in tab grouping API
- **Auto-sort (optional)** - turn on "Auto-sort new tabs" in Settings: a few seconds after tabs finish loading, the ungrouped ones join a matching group, or a new one with other tabs on the same topic, without the review step. Grouped and pinned tabs, private windows, and tabs you take out of a group are left alone; one request at a time, at least 15 seconds apart. It also sorts each window's restored tabs a few seconds after Firefox starts, and the popup's **Sort all windows now** sorts every window's ungrouped tabs at once (up to 100 per request, in turns). The popup shows Auto-sort's last result or error
- **Firefox for Android (experimental)** - tab groups are unavailable on Android, so applying a result sorts your tabs by group instead. This hasn't been tested on a real device yet; please [open an issue](https://github.com/Haya-ChiChi/hayatab/issues) if something doesn't work
- **Privacy-first** - no telemetry, no tracking, API keys stored locally only

## Setup

1. Install the extension from [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/hayatab/) (or load temporarily via `about:debugging`)
2. Open extension settings and choose an AI provider
3. Enter your API key (or point to your Ollama server)
4. Click the toolbar icon and hit **Analyze Tabs**

## Supported Providers

| Provider | Models | Requires |
|----------|--------|----------|
| Claude | Haiku 5.5, Sonnet 5.5 | [API key](https://console.anthropic.com/) |
| OpenAI | GPT-6 Luna, GPT-6.1 Sol | [API key](https://platform.openai.com/) |
| Gemini | Gemini 3.5 Flash-Lite, 3.8 Flash | [API key](https://aistudio.google.com/) |
| Z.AI | GLM 5.3, GLM 5.2, GLM 4.7 Flash, or any model from your account | [API key](https://z.ai/) |
| Ollama | Llama 3.2, Mistral, Qwen 2.5, Gemma 2, Phi-4, custom | [Ollama](https://ollama.com/) on localhost, started with OLLAMA_ORIGINS=moz-extension://* |
| Custom API | Any model on an OpenAI-compatible endpoint (OpenRouter, DeepSeek, Groq, Mistral, Together, xAI, LM Studio, ...) | Base URL + optional API key; host permission for the configured URL is requested only when you set it up |

## Privacy

Only tab titles and URLs are sent to your chosen AI provider when you click "Analyze Tabs", or, with Auto-sort on, as tabs load (ungrouped tabs' titles and URLs, plus your group titles and a few tab titles from each). Nothing else leaves your browser. See the full [privacy policy](PRIVACY.md).

## Tests

`node --test` (Node 18+)

## License

MIT

The bundled fonts, DM Sans and JetBrains Mono, are licensed under the SIL Open Font License 1.1; see `fonts/DM_Sans/OFL.txt` and `fonts/JetBrains_Mono/OFL.txt`.
