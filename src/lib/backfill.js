import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { exportVaultToWebsite, getMarkdownFiles, parseMarkdown } from "./exporter.js";
import {
  extractFileIdRefs,
  needsFileIdBackfill,
  replaceFileIdsInMarkdown
} from "./fileIdRefs.js";
import { ensureFileIdHosted, isMediaStorageConfigured } from "./mediaStorage.js";
import { getTitle } from "./renderer.js";
import { deployWebsiteFiles } from "./siteDeploy.js";
import { log } from "./utils.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldFixTitle(title) {
  const value = String(title || "");
  return (
    /(?:file_id|fileid):/i.test(value) ||
    value.includes("[object Object]") ||
    /^-\s*\[[^\]]+\]\(https?:\/\//.test(value) ||
    /^!\[[^\]]*\]\(/.test(value) ||
    /^#[\p{L}\p{N}_-]+(?:\s+#[\p{L}\p{N}_-]+)+$/u.test(value.trim()) ||
    /^#[\p{L}\p{N}_-]+(?:\s+#[\p{L}\p{N}_-]+)*\.{3}$/u.test(value.trim()) ||
    value.trim().startsWith("#telegram-import")
  );
}

function normalizeTitleLine(line) {
  return String(line || "")
    .replace(/,?\s*\[object Object\]\s*,?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickReadableTitle(body, messageId) {
  const lines = String(body || "")
    .split(/\r?\n/)
    .map((line) => normalizeTitleLine(line.trim()))
    .filter(Boolean);

  const headingLines = lines.filter((line) => /^#{1,3}\s+\S/.test(line));
  const searchLines = headingLines.length ? headingLines : lines;

  for (const line of searchLines) {
    if (/(?:file_id|fileid):/i.test(line)) continue;
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(line)) continue;
    if (/^-\s*\[[^\]]+\]\(https?:\/\//.test(line)) continue;
    if (/^https?:\/\//.test(line)) continue;
    if (/^##\s+/.test(line)) continue;
    if (/^#[\p{L}\p{N}_-]+(?:\s+#[\p{L}\p{N}_-]+)*$/u.test(line)) continue;

    const candidate = line
      .replace(/^#+\s+/, "")
      .replace(/\*\*|__|\*|_/g, "")
      .trim();

    if (!candidate || candidate.length < 8) continue;
    return candidate.length > 80
      ? `${candidate.slice(0, 80).trim()}...`
      : candidate;
  }

  return getTitle(body, messageId);
}

function cleanupBrokenImageHeaders(content) {
  return String(content || "")
    .replace(/^#{1,6}\s*!\[[^\]]*\]\((?:file_id|fileid):[^\n)]*$/gim, "")
    .replace(/^!\[[^\]]*\]\((?:file_id|fileid):[^\n)]*$/gim, "")
    .replace(/\n{3,}/g, "\n\n");
}

function fixFrontmatterTitle(content) {
  const parsed = parseMarkdown(content);
  if (!parsed || !shouldFixTitle(parsed.metadata.title)) {
    return content;
  }

  const messageId =
    parsed.metadata.telegram_message_id || parsed.metadata.id || "post";
  const newTitle = pickReadableTitle(parsed.body, messageId).replaceAll(
    '"',
    '\\"'
  );

  return content.replace(
    /^title:\s*(".*"|'.*'|[^\n]+)/m,
    `title: "${newTitle}"`
  );
}

function prependCoverImage(content, urlByFileId) {
  const parsed = parseMarkdown(content);
  if (!parsed) return content;

  const refs = extractFileIdRefs(content);
  const firstPhoto = refs.find((item) => item.mediaType === "photo");
  if (!firstPhoto) return content;

  const coverUrl = urlByFileId[firstPhoto.fileId];
  if (!coverUrl || parsed.body.includes(coverUrl)) {
    return content;
  }

  const lines = content.split(/\r?\n/);
  let closingFrontmatter = -1;
  let frontmatterMarkers = 0;

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i] === "---") {
      frontmatterMarkers += 1;
      if (frontmatterMarkers === 2) {
        closingFrontmatter = i;
        break;
      }
    }
  }

  if (closingFrontmatter === -1) return content;

  let insertAt = closingFrontmatter + 1;
  while (insertAt < lines.length && !lines[insertAt].trim()) {
    insertAt += 1;
  }

  lines.splice(insertAt, 0, `![Post cover](${coverUrl})`, "");
  return lines.join("\n");
}

/**
 * Backfill hosted media URLs across archived markdown files.
 * @param {Object} config
 * @param {Object} state
 * @param {Object} [options]
 */
export async function backfillVaultMedia(config, state, options = {}) {
  const {
    dryRun = false,
    limit = Infinity,
    delayMs = 300,
    deploy = false
  } = options;

  if (!isMediaStorageConfigured(config)) {
    throw new Error("Media storage is not configured (websitePath / mediaPublicBaseUrl)");
  }

  const vaultPath = path.resolve(process.cwd(), config.vaultPath);
  const mdFiles = await getMarkdownFiles(vaultPath);
  const candidates = [];

  for (const filePath of mdFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = parseMarkdown(content);
    if (
      needsFileIdBackfill(content) ||
      (parsed && shouldFixTitle(parsed.metadata.title))
    ) {
      candidates.push(filePath);
    }
  }

  const selected = candidates.slice(0, limit);
  const summary = {
    scanned: mdFiles.length,
    candidates: candidates.length,
    processed: 0,
    updated: 0,
    hosted: 0,
    cached: 0,
    failed: 0,
    deployed: false
  };

  log(
    `[Backfill] Found ${summary.candidates} file(s) with file_id placeholders out of ${summary.scanned}`
  );

  const stagedDeployPaths = [];

  for (const filePath of selected) {
    summary.processed += 1;
    const original = await fs.readFile(filePath, "utf8");
    const refs = extractFileIdRefs(original);
    const urlByFileId = {};

    if (!refs.length) {
      if (dryRun) continue;

      let updated = cleanupBrokenImageHeaders(original);
      updated = fixFrontmatterTitle(updated);
      if (updated !== original) {
        await fs.writeFile(filePath, updated, "utf8");
        summary.updated += 1;
        log(`[Backfill] Repaired title in ${path.relative(process.cwd(), filePath)}`);
      }
      continue;
    }

    for (const ref of refs) {
      if (dryRun) {
        const cachedUrl = state.mediaByFileId?.[ref.fileId];
        if (cachedUrl) {
          urlByFileId[ref.fileId] = cachedUrl;
          summary.cached += 1;
        } else {
          log(`[Backfill] Would host ${ref.mediaType} ${ref.fileId}`);
        }
        continue;
      }

      try {
        const hosted = await ensureFileIdHosted(config, state, ref, {
          deploy: false
        });
        urlByFileId[ref.fileId] = hosted.publicUrl;
        if (hosted.cached) {
          summary.cached += 1;
        } else {
          summary.hosted += 1;
          if (hosted.absolutePath) {
            stagedDeployPaths.push(hosted.absolutePath);
          }
        }
        if (delayMs > 0) {
          await sleep(delayMs);
        }
      } catch (error) {
        summary.failed += 1;
        log(`[Backfill] Failed ${ref.fileId}: ${error.message}`);
      }
    }

    if (dryRun) {
      continue;
    }

    let updated = replaceFileIdsInMarkdown(original, urlByFileId);
    updated = cleanupBrokenImageHeaders(updated);
    updated = fixFrontmatterTitle(updated);
    updated = prependCoverImage(updated, urlByFileId);

    if (updated !== original) {
      await fs.writeFile(filePath, updated, "utf8");
      summary.updated += 1;
      log(`[Backfill] Updated ${path.relative(process.cwd(), filePath)}`);
    }
  }

  if (!dryRun) {
    await exportVaultToWebsite(config);
    stagedDeployPaths.push(
      path.resolve(config.websitePath, "public/data/posts.json")
    );

    if (deploy && config.websitePath) {
      const result = deployWebsiteFiles(config, stagedDeployPaths);
      summary.deployed = result.pushed;
    }
  }

  return summary;
}