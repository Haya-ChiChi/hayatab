# Privacy Policy — Tab Organizer

**Last updated:** 2026-02-17

## What This Extension Does

Tab Organizer uses AI to analyze your open browser tabs and suggest logical groupings. It sends tab metadata to an AI provider you choose, then organizes your tabs based on the response.

## Data Sent Externally

When you click "Analyze Tabs", the extension sends **tab titles and URLs** from your current browser window to your chosen AI provider:

- **Claude** (Anthropic) — api.anthropic.com
- **OpenAI** — api.openai.com
- **Gemini** (Google) — generativelanguage.googleapis.com
- **Ollama** (Local) — localhost only, no data leaves your machine

No other data is sent. The extension does not transmit browsing history, cookies, passwords, bookmarks, or any personal information beyond tab titles and URLs.

**Gemini note:** The Google AI API requires the API key to be included as a URL query parameter. This is a requirement of Google's API design and cannot be avoided when using Gemini.

## Data Stored Locally

The following is stored in your browser's local extension storage (`browser.storage.local`), which is sandboxed to this extension and never transmitted:

- Your AI provider selection and model choice
- Your API key(s) for each provider
- Ollama server URL
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
- **Host permissions**: Connect to AI provider APIs and localhost (for Ollama)

## Contact

If you have questions about this privacy policy, open an issue on the [GitHub repository](https://github.com/Haya-ChiChi/tab-organizer).
