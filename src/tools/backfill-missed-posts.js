import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { loadConfig } from "../lib/config.js";
import { loadState, saveState } from "../lib/state.js";
import { getChannelTitle } from "../lib/telegram.js";
import { buildTags } from "../lib/tagger.js";
import {
  extractText,
  getLinks,
  getTitle,
  renderMarkdown,
} from "../lib/renderer.js";
import { ensureDir, log, slugify } from "../lib/utils.js";
import { hostMessageMedia } from "../lib/mediaStorage.js";
import { deployPostsJsonIfNeeded } from "../lib/websiteSync.js";

const ROOT = process.cwd();

function readArg(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return "";
}

/**
 * Custom telegram request that parses JSON even on non-200 responses.
 */
async function telegramRequest(botToken, method, params) {
  const url = new URL(`https://api.telegram.org/bot${botToken}/${method}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, { method: "GET" });
  return await response.json();
}

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

  const hostedMedia = await hostMessageMedia(config, state, message);
  const markdown = renderMarkdown({ channelTitle, message, tags, hostedMedia });
  await ensureDir(filePath);
  await fs.writeFile(filePath, markdown, "utf8");

  state.messages[String(message.message_id)] = {
    filePath: path.relative(ROOT, filePath),
    updatedAt: new Date().toISOString(),
    edited: Boolean(message.edit_date),
    mediaUrls: hostedMedia.filter((item) => item.publicUrl).map((item) => item.publicUrl),
  };

  try {
    const { exportVaultToWebsite } = await import("../lib/exporter.js");
    await exportVaultToWebsite(config);
    deployPostsJsonIfNeeded(config);
  } catch (err) {
    log(`Failed to run export after writing post: ${err.message}`);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const config = await loadConfig();
  const state = await loadState();

  const verifyChatId = config.verifyChatId;
  if (!verifyChatId) {
    console.error("Error: verifyChatId is not configured in config.json.");
    process.exit(1);
  }

  const channelTitle = await getChannelTitle(config.botToken, config.channelChatId);

  // Find max message ID in current state
  const messageIds = Object.keys(state.messages).map(Number);
  let maxSyncedId = messageIds.length > 0 ? Math.max(...messageIds) : 0;

  console.log(`Starting backfill from ID ${maxSyncedId + 1} for channel "${channelTitle}" (${config.channelChatId})...`);
  if (dryRun) {
    console.log("Running in DRY-RUN mode. No changes will be written.");
  }

  let currentId = maxSyncedId + 1;
  let consecutiveMisses = 0;
  const MAX_CONSECUTIVE_MISSES = 20;
  let syncedCount = 0;

  while (consecutiveMisses < MAX_CONSECUTIVE_MISSES) {
    try {
      const json = await telegramRequest(config.botToken, "forwardMessage", {
        chat_id: verifyChatId,
        from_chat_id: config.channelChatId,
        message_id: currentId,
        disable_notification: true,
      });

      if (!json.ok) {
        const description = String(json.description || "").toLowerCase();
        if (
          description.includes("message to forward not found") ||
          description.includes("message not found") ||
          description.includes("message_id_invalid")
        ) {
          consecutiveMisses++;
          currentId++;
          continue;
        }
        throw new Error(`Telegram forwardMessage error: ${json.description}`);
      }

      // Found a valid message!
      consecutiveMisses = 0;
      const res = json.result;

      // Extract the original date of the channel post
      const originalDate = res.forward_date || res.forward_origin?.date || res.date;

      // Create a message structure mimicking the channel post
      const channelMessage = {
        ...res,
        message_id: currentId,
        date: originalDate,
        chat: {
          id: Number(config.channelChatId),
          type: "channel",
          title: channelTitle,
        },
      };

      const text = extractText(channelMessage);
      const title = getTitle(text, currentId);

      if (dryRun) {
        console.log(`[Dry-run] Would sync post ID ${currentId} | Title: "${title}" | Date: ${new Date(originalDate * 1000).toISOString()}`);
      } else {
        console.log(`Syncing post ID ${currentId} | Title: "${title}"...`);
        await writeMessageToVault(config, state, channelTitle, channelMessage);
        syncedCount++;

        // Save state progressively to avoid losing progress
        await saveState(state);
      }

      // Delete the forwarded message from the user's private chat to clean up
      if (res.message_id) {
        await telegramRequest(config.botToken, "deleteMessage", {
          chat_id: verifyChatId,
          message_id: res.message_id,
        });
      }

    } catch (error) {
      console.error(`Error processing message ID ${currentId}:`, error.message);
      // Wait a bit on error and stop or retry
      await new Promise((resolve) => setTimeout(resolve, 3000));
      break;
    }

    currentId++;
    // Add small delay to avoid hitting rate limits
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  console.log(`\nBackfill finished! Recovered ${syncedCount} missing posts.`);
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exitCode = 1;
});
