# Hayatab

AI-powered tab grouping for Firefox. Analyzes your open tabs and organizes them into logical groups using your choice of AI provider.

## Features

- **One-click analysis** - click "Analyze Tabs" and get suggested groups instantly
- **Multiple AI providers** - Claude, OpenAI, Gemini, Z.AI, or Ollama (fully local)
- **Live model discovery** - fetch the model list directly from your provider's account
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
| OpenAI | GPT-6 Luna, GPT-6.1 Sol | [API key](https://platform.openai.com/) |
| Gemini | Gemini 3.5 Flash-Lite, 3.8 Flash | [API key](https://aistudio.google.com/) |
| Z.AI | GLM 5.3, GLM 5.2, GLM 4.7 Flash, or any model from your account | [API key](https://z.ai/) |
| Ollama | Llama 3.2, Mistral, Qwen 2.5, Gemma 2, Phi-4, custom | [Ollama](https://ollama.com/) on localhost, started with OLLAMA_ORIGINS=moz-extension://* |

## Privacy

Only tab titles and URLs are sent to your chosen AI provider when you click "Analyze Tabs". Nothing else leaves your browser. See the full [privacy policy](PRIVACY.md).

## Tests

`node --test` (Node 18+)

## License

MIT
