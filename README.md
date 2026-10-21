# Hayatab

AI-powered tab grouping for Firefox. Analyzes your open tabs and organizes them into logical groups using your choice of AI provider.

## Features

- **One-click analysis** - click "Analyze Tabs" and get suggested groups instantly
- **Multiple AI providers** - Claude, OpenAI, Gemini, or Ollama (fully local)
- **Native tab groups** - uses Firefox's built-in tab grouping API
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
| OpenAI | GPT-5.6 Luna, GPT-5.6 Sol | [API key](https://platform.openai.com/) |
| Gemini | Gemini 3.1 Flash-Lite, 3.5 Flash | [API key](https://aistudio.google.com/) |
| Ollama | Llama 3.2, Mistral, Qwen 2.5, Gemma 2, Phi-4, custom | [Ollama](https://ollama.com/) on localhost, started with OLLAMA_ORIGINS=moz-extension://* |

## Privacy

Only tab titles and URLs are sent to your chosen AI provider when you click "Analyze Tabs". Nothing else leaves your browser. See the full [privacy policy](PRIVACY.md).

## Tests

`node --test` (Node 18+)

## License

MIT
