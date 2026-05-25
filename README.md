# 🚀 Telegram to Obsidian Sync

A sleek Node.js utility that automatically captures Telegram channel posts and transforms them into organized Markdown notes for your Obsidian vault.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)
![Obsidian](https://img.shields.io/badge/Obsidian-7C3AED?style=for-the-badge&logo=obsidian&logoColor=white)

---

## ✨ Key Features

- 📥 **Real-time Sync**: Listens for new and edited channel posts via Telegram Bot API.
- 📂 **Smart Organization**: Automatically groups notes into folders by year within a centralized directory (default: `/posts/`).
- 🏷️ **Auto-Tagging**: Extracts hashtags, links, topics, and repeated keywords to generate smart tags.
- 🛡️ **Duplicate Protection**: Uses a state management system to ensure no post is imported twice.
- 🌐 **Website Export**: Compiles your Obsidian notes into a structured `posts.json` file inside your portfolio/website codebase for interactive knowledge visualization.
- 🏗️ **Modular Architecture**: Clean code structure for easy maintenance and extension.
- 🛡️ **Public-Safe**: Designed to be shared without exposing your private tokens or vault data.

---

## ⚡ Quick Start

### 1. Bot Setup
1. Message [@BotFather](https://t.me/botfather) and create a new bot.
2. Add your bot as an **Administrator** to your Telegram channel.

### 2. Installation & Launch
Run the launcher script. If it's your first time, it will create a `config.json` for you:
```powershell
.\start_sync.ps1
```

### 3. Configuration
Open `config.json` and fill in your details (including `websitePath` to integrate with your portfolio website):
```json
{
  "botToken": "123456:ABC-DEF...",
  "channelChatId": "-1001234567890",
  "vaultPath": "./posts",
  "baseTags": ["telegram-import", "live-sync"],
  "websitePath": "d:/_CODE_2026_/portfolio-clone"
}
```

---

## 🌐 Website Integration

The sync service automatically compiles your Obsidian Markdown posts into a single structured static JSON feed at `${websitePath}/public/data/posts.json` so your front-end application can query it at runtime.

- **Auto-Sync**: The export runs automatically on bot startup, and every time a new or updated post is processed.
- **Manual Export**: Run the exporter script manually using:
  ```powershell
  npm run export-site
  ```


## ⚙️ Advanced Configuration

### Environment Variables
You can override `config.json` values using environment variables:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHANNEL_CHAT_ID`
- `OBSIDIAN_VAULT_PATH`
- `TELEGRAM_POLL_TIMEOUT_SEC`
- `TELEGRAM_POLL_INTERVAL_MS`

### Finding your Channel ID
Not sure what your `channelChatId` is?
1. Post a test message in your channel.
2. Run the inspection helper:
   ```powershell
   npm run inspect-updates
   ```
3. Look for the `chat -> id` in the JSON output.

---

## 🔒 Security & Public Safety

This repository is configured to be **public-ready**. Follow these rules to keep your data safe:

> [!IMPORTANT]
> **Never Commit Secrets**
> Ensure `config.json` and `state.json` are listed in your `.gitignore`.

- ✅ **Keep in Git**: `src/`, `config.example.json`, `package.json`, `README.md`.
- ❌ **Exclude from Git**: `config.json`, `state.json`, `posts/` (exported notes), and private media.

If you ever accidentally commit a `botToken`, **revoke it immediately** via @BotFather.

---

## 📁 Project Structure

| File/Folder | Purpose |
| :--- | :--- |
| `src/index.js` | Main entry point of the sync service. |
| `src/lib/` | Core logic modules (API, tagger, renderer, etc.). |
| `src/tools/` | Utility tools like the update inspector. |
| `posts/` | Centralized folder for synced Markdown notes. |
| `start_sync.ps1` | One-click PowerShell launcher. |
| `config.json` | Local configuration (ignored by Git). |
| `state.json` | Local sync state (ignored by Git). |

---

## ⚠️ Current Limitations

- **Media**: Currently saves Telegram `file_id` as metadata (files are not downloaded locally yet).
- **Formatting**: Support for complex HTML/Markdown formatting is minimal.
- **Scope**: Optimized for syncing a single primary channel.

---
*Created with ❤️ for the Obsidian community.*
