# Hayatab

AI-powered tab grouping for Firefox. Analyzes your open tabs and organizes them into logical groups using your choice of AI provider.

## Features

- **One-click analysis** - click "Analyze Tabs" and get suggested groups instantly
- **Multiple AI providers** - Claude, OpenAI, Gemini, or Ollama (fully local)
- **Native tab groups** - uses Firefox's built-in tab grouping API
- **Zen browser support** - falls back to sorting tabs by group when native grouping isn't available
- **Privacy-first** - no telemetry, no tracking, API keys stored locally only

## Setup

1. Install the extension from [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/hayatab/) (or load temporarily via `about:debugging`)
2. Open extension settings and choose an AI provider
3. Enter your API key (or point to your Ollama server)
4. Click the toolbar icon and hit **Analyze Tabs**

## Supported Providers

| Provider | Models | Requires |
|----------|--------|----------|
| Claude | Auto-detected from your account | [API key](https://console.anthropic.com/) |
| OpenAI | Auto-detected from your account | [API key](https://platform.openai.com/) |
| Gemini | Auto-detected from your account | [API key](https://aistudio.google.com/) |
| Ollama | Auto-detected from your local server (+ custom) | [Ollama](https://ollama.com/) running on localhost |

The model dropdown is fetched live from each provider when you open Settings, so
newly released models appear and deprecated ones drop off automatically. If a
provider can't be reached, a built-in fallback list is shown.

## Privacy

Only tab titles and URLs are sent to your chosen AI provider when you click "Analyze Tabs". Nothing else leaves your browser. See the full [privacy policy](PRIVACY.md).

## License

MIT
