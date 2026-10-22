# Privacy Policy - Hayatab

**Last updated:** 2026-10-21

## What This Extension Does

Hayatab uses AI to analyze your open browser tabs and suggest logical groupings. It sends tab metadata to an AI provider you choose, then organizes your tabs based on the response.

## Data Sent Externally

When you click "Analyze Tabs", the extension sends **tab titles and URLs** from your current browser window to your chosen AI provider:

- **Claude** (Anthropic) - api.anthropic.com
- **OpenAI** - api.openai.com
- **Gemini** (Google) - generativelanguage.googleapis.com
- **Ollama** (Local) - localhost only, no data leaves your machine
- **Custom API** - the OpenAI-compatible base URL you configure in settings (e.g. OpenRouter, DeepSeek, Groq, or a local server such as LM Studio). Tab titles and URLs are sent only to that URL, and only when you choose this provider. The extension asks Firefox for permission to access that single host only when you save the Custom API settings - it is never requested at install or update time, and no other host permission is requested

No other data is sent. The extension does not transmit browsing history, cookies, passwords, bookmarks, or any personal information beyond tab titles and URLs.

## Data Stored Locally

The following is stored in your browser's local extension storage (`browser.storage.local`), which is sandboxed to this extension and never transmitted:

- Your AI provider selection and model choice
- Your API key(s) for each provider
- Ollama server URL
- Custom API base URL (and its API key, if you provided one)
- Cooldown setting
- Timestamp of last analysis (for rate limiting)

## Data NOT Collected

- No analytics or telemetry
- No usage tracking
- No crash reports
- No cookies or tracking pixels
- No third-party scripts

The extension makes zero network requests except when you explicitly click "Analyze Tabs" or "Apply Groups".

## Permissions

- **tabs**: Read tab titles and URLs for AI analysis
- **tabGroups**: Create native browser tab groups
- **storage**: Save your settings locally
- **Host permissions**: Connect to AI provider APIs and localhost (for Ollama). The Custom API provider additionally uses an *optional* host permission for the single base URL you configure, granted only when you set it up

## Contact

If you have questions about this privacy policy, open an issue on the [GitHub repository](https://github.com/Haya-ChiChi/hayatab).
