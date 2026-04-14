# Setup Guide

## What It Does

The service listens for new Telegram channel posts through the Bot API and writes each post into a Markdown file for Obsidian.

Supported:
- `channel_post`
- `edited_channel_post`
- one `.md` file per post
- year-based folders
- basic auto-tagging
- duplicate protection through `state.json`

## Files

- `telegram_to_obsidian.mjs` - main sync service
- `config.example.json` - config template
- `config.json` - local working config
- `state.json` - sync state
- `start_sync.ps1` - quick launcher
- `inspect_updates.mjs` - debug helper

## Quick Start

1. Create a bot via `@BotFather`.
2. Add the bot as an admin to your Telegram channel.
3. Run:

```powershell
.\start_sync.ps1
```

If `config.json` does not exist yet, the script will create it from `config.example.json`.

4. Fill `config.json`:
- `botToken`
- `channelChatId`
- `vaultPath`

5. Run again:

```powershell
.\start_sync.ps1
```

## Example Config

```json
{
  "botToken": "123456:ABC...",
  "channelChatId": "-1001234567890",
  "vaultPath": "./obsidian_posts_live",
  "pollTimeoutSec": 25,
  "pollIntervalMs": 1500,
  "baseTags": ["telegram-import", "live-sync"]
}
```

## Environment Variables

You can keep secrets out of `config.json` by using environment variables:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHANNEL_CHAT_ID`
- `OBSIDIAN_VAULT_PATH`
- `TELEGRAM_POLL_TIMEOUT_SEC`
- `TELEGRAM_POLL_INTERVAL_MS`

Environment variables override values from `config.json`.

## How to Find `channelChatId`

Publish a test post in the channel, then run:

```powershell
npm run inspect-updates
```

Find `channel_post -> chat -> id` in the output.

## Output Folder

By default notes are written to:

```text
./obsidian_posts_live
```

If you want to write directly into a specific vault folder, set an absolute path in `vaultPath`.

## Public Repo Safety

Do not publish:
- `config.json`
- `state.json`
- generated notes
- private media files
- personal `.obsidian` workspace files

If a real bot token was ever committed, revoke and reissue it through `@BotFather`.

## Current Limitations

- media is stored only as Telegram metadata, not downloaded to disk
- Telegram formatting is handled as plain text in the live sync path
- the service is currently focused on one channel
