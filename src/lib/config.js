import path from "node:path";
import process from "node:process";
import { exists, readJson } from "./utils.js";

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "config.json");
const CONFIG_EXAMPLE_PATH = path.join(ROOT, "config.example.json");

/**
 * Load configuration from file and environment variables.
 * @returns {Promise<Object>}
 */
export async function loadConfig() {
  if (!(await exists(CONFIG_PATH))) {
    throw new Error(
      `config.json not found. Copy ${path.basename(
        CONFIG_EXAMPLE_PATH
      )} to config.json and fill your values.`
    );
  }

  const config = await readJson(CONFIG_PATH);

  // Default values and environment overrides
  const botToken = process.env.TELEGRAM_BOT_TOKEN || config.botToken;
  const channelChatId =
    process.env.TELEGRAM_CHANNEL_CHAT_ID || config.channelChatId;
  const vaultPath =
    process.env.OBSIDIAN_VAULT_PATH || config.vaultPath || "./posts";
  const pollTimeoutSec = Number(
    process.env.TELEGRAM_POLL_TIMEOUT_SEC || config.pollTimeoutSec || 25
  );
  const pollIntervalMs = Number(
    process.env.TELEGRAM_POLL_INTERVAL_MS || config.pollIntervalMs || 1500
  );

  if (!botToken || botToken === "PASTE_YOUR_BOT_TOKEN_HERE") {
    throw new Error("Set botToken in config.json");
  }

  if (!channelChatId) {
    throw new Error("Set channelChatId in config.json");
  }

  return {
    ...config,
    botToken,
    channelChatId,
    vaultPath: path.resolve(ROOT, vaultPath),
    pollTimeoutSec,
    pollIntervalMs,
    baseTags: Array.isArray(config.baseTags)
      ? config.baseTags
      : ["telegram-import", "live-sync"],
  };
}
