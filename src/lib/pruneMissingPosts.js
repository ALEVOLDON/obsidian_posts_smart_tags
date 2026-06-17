import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { channelPostExists } from "./channelVerify.js";
import { exportVaultToWebsite, getMarkdownFiles, parseMarkdown } from "./exporter.js";
import { log } from "./utils.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveVerifyChatId(config) {
  return (
    process.env.VERIFY_CHAT_ID ||
    config.verifyChatId ||
    process.env.OWNER_USER_IDS?.split(",")?.[0]?.trim() ||
    ""
  );
}

/**
 * Remove vault notes whose Telegram messages were deleted from the channel.
 * @param {Object} config
 * @param {Object} state
 * @param {Object} [options]
 */
export async function pruneMissingPosts(config, state, options = {}) {
  const {
    dryRun = false,
    since = "",
    delayMs = 120,
    limit = 0,
  } = options;

  const verifyChatId = resolveVerifyChatId(config);
  if (!verifyChatId) {
    throw new Error(
      "Set verifyChatId in config.json or VERIFY_CHAT_ID / OWNER_USER_IDS in env"
    );
  }

  const vaultPath = path.resolve(process.cwd(), config.vaultPath);
  const mdFiles = await getMarkdownFiles(vaultPath);
  const candidates = [];

  for (const filePath of mdFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = parseMarkdown(content);
    if (!parsed?.metadata) continue;

    const messageId = Number(
      parsed.metadata.telegram_message_id || parsed.metadata.id
    );
    const date = String(parsed.metadata.date || "");
    if (!messageId) continue;
    if (since && !date.startsWith(since)) continue;

    candidates.push({
      filePath,
      relPath: path.relative(process.cwd(), filePath),
      messageId,
      title: parsed.metadata.title || `Post ${messageId}`,
      date,
    });
  }

  candidates.sort((a, b) => b.messageId - a.messageId);
  const scanList = limit > 0 ? candidates.slice(0, limit) : candidates;

  const summary = {
    scanned: scanList.length,
    kept: 0,
    missing: 0,
    errors: 0,
    removed: [],
  };

  for (const entry of scanList) {
    try {
      const exists = await channelPostExists({
        botToken: config.botToken,
        channelChatId: config.channelChatId,
        messageId: entry.messageId,
        verifyChatId,
      });

      if (exists) {
        summary.kept += 1;
      } else {
        summary.missing += 1;
        summary.removed.push(entry);

        if (dryRun) {
          log(`[Prune] Would remove missing post ${entry.messageId}: ${entry.relPath}`);
        } else {
          await fs.unlink(entry.filePath);
          delete state.messages[String(entry.messageId)];
          log(`[Prune] Removed missing post ${entry.messageId}: ${entry.relPath}`);
        }
      }
    } catch (error) {
      summary.errors += 1;
      log(`[Prune] Error checking ${entry.messageId}: ${error.message}`);
    }

    if (delayMs > 0) await sleep(delayMs);
  }

  if (!dryRun && summary.missing > 0) {
    await exportVaultToWebsite(config);
  }

  return summary;
}