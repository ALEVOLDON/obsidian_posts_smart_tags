# Telegram to Obsidian Sync

Small Node.js utility that listens to Telegram channel posts through the Bot API and writes each post into a Markdown note for Obsidian.

This repository is meant to be a safe public example:
- keep `config.example.json` in Git
- keep `config.json` and `state.json` out of Git
- do not publish generated notes or private media exports

## Features

- handles `channel_post`
- handles `edited_channel_post`
- one Markdown file per Telegram post
- folders grouped by year
- basic auto-tagging from hashtags, links, topics, and repeated keywords
- avoids duplicates through `state.json`

## Project Files

- `telegram_to_obsidian.mjs` - main sync service
- `start_sync.ps1` - quick PowerShell launcher
- `inspect_updates.mjs` - helper for inspecting Telegram updates
- `config.example.json` - safe config template
- `README_SYNC.md` - setup guide

## Safe Publishing Checklist

Before making the repository public:

1. Revoke any bot token that has ever been committed or shared.
2. Keep only `config.example.json` in Git.
3. Do not publish `config.json`, `state.json`, exported notes, `result.json`, or private media files.
4. Review `.obsidian/` and only keep files that are useful as examples.

## Configuration

The app reads values from `config.json`, and environment variables can override them:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHANNEL_CHAT_ID`
- `OBSIDIAN_VAULT_PATH`
- `TELEGRAM_POLL_TIMEOUT_SEC`
- `TELEGRAM_POLL_INTERVAL_MS`

Copy `config.example.json` to `config.json` and fill your own values:

```json
{
  "botToken": "PASTE_YOUR_BOT_TOKEN_HERE",
  "channelChatId": "-1001234567890",
  "vaultPath": ".",
  "pollTimeoutSec": 25,
  "pollIntervalMs": 1500,
  "baseTags": [
    "telegram-import",
    "live-sync"
  ]
}
```

## Run

```powershell
.\start_sync.ps1
```

Or directly:

```powershell
node .\telegram_to_obsidian.mjs
```

## Notes

- media is currently stored as Telegram `file_id` metadata, not downloaded to disk
- text formatting support is intentionally minimal
- the current sync service is focused on one Telegram channel
