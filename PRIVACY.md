# Privacy Policy - Hayatab

**Last updated:** 2026-11-23

## What This Extension Does

Hayatab uses AI to analyze your open browser tabs and suggest logical groupings. It sends tab metadata to an AI provider you choose, then organizes your tabs based on the response.

## Data Sent Externally

When you click "Analyze Tabs", the extension sends **tab titles and URLs** from your current browser window to your chosen AI provider:

- **Claude** (Anthropic) - api.anthropic.com
- **OpenAI** - api.openai.com
- **Gemini** (Google) - generativelanguage.googleapis.com
- **Z.AI** - api.z.ai
- **Ollama** (Local) - localhost only, no data leaves your machine
- **Custom API** - the OpenAI-compatible base URL you configure in settings (e.g. OpenRouter, DeepSeek, Groq, or a local server such as LM Studio). Tab titles and URLs are sent only to that URL, and only when you choose this provider. The extension asks Firefox for permission to access that single host only when you save the Custom API settings - it is never requested at install or update time, and no other host permission is requested

**Auto-sort** (optional, off by default; the "Auto-sort new tabs" setting): while it is on, the extension sends data without a click. A few seconds after tabs finish loading, it sends the **titles and URLs of that window's ungrouped tabs**, and the **titles of its tab groups with up to 5 tab titles from each**, to the same provider. Pinned tabs, grouped tabs, tabs in private windows and tabs you took out of a group are never sent. Requests are at least 15 seconds apart.

No other data is sent. The extension does not transmit browsing history, cookies, passwords, bookmarks, or any personal information beyond tab titles and URLs.

## Data Stored Locally

The following is stored in your browser's local extension storage (`browser.storage.local`), which is sandboxed to this extension and never transmitted:

- Your AI provider selection and model choice
- Your API key(s) for each provider
- Ollama server URL
- Custom API base URL (and its API key, if you provided one)
- Cooldown setting
- Whether Auto-sort is on
- Auto-sort's last result (when it ran, how many tabs it grouped, or its error), shown in the toolbar popup
- Timestamp of last analysis (for rate limiting)

## Data NOT Collected

- No analytics or telemetry
- No usage tracking
- No crash reports
- No cookies or tracking pixels
- No third-party scripts

The extension makes network requests only when you explicitly ask it to, or after you turn Auto-sort on:

- **Analyze Tabs** sends tab titles and URLs to your chosen provider, as described above.
- **Auto-sort**, when you turn it on, sends ungrouped tabs' titles and URLs and group titles as tabs load, and once for each window a few seconds after the browser starts, as described above.
- **Sort all windows now** (the toolbar popup) sends the same data for every non-private window, once, when you click it.
- **Load available models** (the refresh button next to the model picker in settings) asks your chosen provider for its model list. This request carries only your API key for that provider, never any tab data.

"Apply Groups" works entirely inside your browser and sends nothing.

## Permissions

- **tabs**: Read tab titles and URLs for AI analysis
- **tabGroups**: Create native browser tab groups (on Firefox for Android, where tab groups are unavailable, tabs are sorted by group instead)
- **storage**: Save your settings locally
- **sessions** (optional, asked for when you turn Auto-sort on): marks a tab you took out of a group in the browser's own session data, so Auto-sort leaves it alone after a restart. Nothing is read from your session history
- **Host permissions**: Connect to AI provider APIs and localhost (for Ollama). The Custom API provider additionally uses an *optional* host permission for the single base URL you configure, granted only when you set it up

## Contact

If you have questions about this privacy policy, open an issue on the [GitHub repository](https://github.com/Haya-ChiChi/hayatab).
