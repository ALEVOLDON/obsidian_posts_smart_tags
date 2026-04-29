import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { loadConfig } from "./lib/config.js";
import { loadState, saveState } from "./lib/state.js";
import { apiCall, getChannelTitle } from "./lib/telegram.js";
import { buildTags } from "./lib/tagger.js";
import {
  extractText,
  getLinks,
  getTitle,
  renderMarkdown,
} from "./lib/renderer.js";
import { ensureDir, log, slugify } from "./lib/utils.js";

const ROOT = process.cwd();

/**
 * Construct the destination file path for a message.
 */
function buildFilePath(vaultPath, message, title) {
  const date = new Date(message.date * 1000);
  const year = String(date.getUTCFullYear());
  const fileName = `${year}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getUTCDate()).padStart(2, "0")}_${String(
    date.getUTCHours()
  ).padStart(2, "0")}-${String(date.getUTCMinutes()).padStart(
    2,
    "0"
  )}-${String(date.getUTCSeconds()).padStart(2, "0")}_${slugify(
    title
  )}_id-${message.message_id}.md`;
  return path.join(vaultPath, year, fileName);
}

/**
 * Write a single Telegram message to the Obsidian vault.
 */
async function writeMessageToVault(config, state, channelTitle, message) {
  const text = extractText(message);
  const title = getTitle(text, message.message_id);
  const links = getLinks(text);
  const tags = buildTags(text, links, config.baseTags);

  const mapped = state.messages[String(message.message_id)];
  const filePath = mapped?.filePath
    ? path.resolve(ROOT, mapped.filePath)
    : buildFilePath(config.vaultPath, message, title);

  const markdown = renderMarkdown({ channelTitle, message, tags });
  await ensureDir(filePath);
  await fs.writeFile(filePath, markdown, "utf8");

  state.messages[String(message.message_id)] = {
    filePath: path.relative(ROOT, filePath),
    updatedAt: new Date().toISOString(),
    edited: Boolean(message.edit_date),
  };
}

/**
 * Handle a single update from Telegram.
 */
async function processUpdate(config, state, channelTitle, update) {
  const message = update.channel_post || update.edited_channel_post || null;
  if (!message) return;
  if (String(message.chat.id) !== String(config.channelChatId)) return;

  await writeMessageToVault(config, state, channelTitle, message);
  const status = update.edited_channel_post ? "updated" : "created";
  log(`${status} post ${message.message_id}`);
}

/**
 * Main application loop.
 */
async function main() {
  const config = await loadConfig();
  const state = await loadState();
  const channelTitle = await getChannelTitle(
    config.botToken,
    config.channelChatId
  );

  await fs.mkdir(config.vaultPath, { recursive: true });
  log(`Vault path: ${config.vaultPath}`);
  log(`Listening for Telegram posts from ${config.channelChatId}`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const updates = await apiCall(config.botToken, "getUpdates", {
        offset: state.lastUpdateId + 1,
        timeout: config.pollTimeoutSec,
        allowed_updates: JSON.stringify(["channel_post", "edited_channel_post"]),
      });

      for (const update of updates) {
        await processUpdate(config, state, channelTitle, update);
        state.lastUpdateId = Math.max(state.lastUpdateId, update.update_id);
      }

      if (updates.length) {
        await saveState(state);
      }
    } catch (error) {
      log(`Error: ${error.message}`);
      await saveState(state);
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(config.pollIntervalMs, 3000))
      );
    }

    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
