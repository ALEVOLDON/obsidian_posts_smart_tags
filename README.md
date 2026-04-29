# 🚀 Telegram to Obsidian Sync

A sleek Node.js utility that automatically captures Telegram channel posts and transforms them into organized Markdown notes for your Obsidian vault.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)
![Obsidian](https://img.shields.io/badge/Obsidian-7C3AED?style=for-the-badge&logo=obsidian&logoColor=white)

---

## ✨ Key Features

- 📥 **Real-time Sync**: Listens for new and edited channel posts via Telegram Bot API.
- 📂 **Smart Organization**: Automatically groups notes into folders by year (`/2024/`, `/2025/`).
- 🏷️ **Auto-Tagging**: Extracts hashtags, links, and repeated keywords to generate smart tags.
- 🛡️ **Duplicate Protection**: Uses a state management system to ensure no post is imported twice.
- 🛠️ **Public-Safe Architecture**: Designed to be shared without exposing your private tokens or vault data.

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
Open `config.json` and fill in your details:
```json
{
  "botToken": "123456:ABC-DEF...",
  "channelChatId": "-1001234567890",
  "vaultPath": "C:/Users/YourName/Documents/MyVault/TelegramNotes",
  "baseTags": ["telegram-import", "live-sync"]
}
```

---

## ⚙️ Advanced Configuration

### Environment Variables
You can override `config.json` values using environment variables (ideal for CI/CD or Docker):
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHANNEL_CHAT_ID`
- `OBSIDIAN_VAULT_PATH`

### Finding your Channel ID
Not sure what your `channelChatId` is?
1. Post a test message in your channel.
2. Run the inspection helper:
   ```powershell
   node .\inspect_updates.mjs
   ```
3. Look for the `chat -> id` in the JSON output.

---

## 🔒 Security & Public Safety

This repository is configured to be **public-ready**. Follow these rules to keep your data safe:

> [!IMPORTANT]
> **Never Commit Secrets**
> Ensure `config.json` and `state.json` are listed in your `.gitignore`.

- ✅ **Keep in Git**: `config.example.json`, `*.mjs`, `README.md`.
- ❌ **Exclude from Git**: `config.json`, `state.json`, your exported `.md` notes, and private media.

If you ever accidentally commit a `botToken`, **revoke it immediately** via @BotFather.

---

## 📁 Project Structure

| File | Purpose |
| :--- | :--- |
| `telegram_to_obsidian.mjs` | The heart of the sync service. |
| `start_sync.ps1` | One-click PowerShell launcher. |
| `inspect_updates.mjs` | Debug tool to see raw Telegram data. |
| `config.example.json` | Template for your local configuration. |

---

## ⚠️ Current Limitations

- **Media**: Currently saves Telegram `file_id` as metadata (files are not downloaded locally yet).
- **Formatting**: Support for complex HTML/Markdown formatting is minimal.
- **Scope**: Optimized for syncing a single primary channel.

---
*Created with ❤️ for the Obsidian community.*
