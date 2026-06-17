import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { exportVaultToWebsite, getMarkdownFiles, parseMarkdown } from "./exporter.js";
import { getTitle } from "./renderer.js";
import { sanitizeRichArtifacts } from "./richText.js";
import { log } from "./utils.js";

function needsRichCleanup(content) {
  return (
    content.includes("[object Object]") ||
    /\n-\s*\n/.test(content) ||
    /\n  - object\n/.test(content)
  );
}

function replaceFrontmatterTitle(content, title) {
  const escaped = title.replaceAll('"', '\\"');
  return content.replace(
    /^title:\s*(".*"|'.*'|[^\n]+)/m,
    `title: "${escaped}"`
  );
}

function removeObjectTag(content) {
  return content.replace(/\n  - object\n/g, "\n");
}

function replaceBody(content, body) {
  const parsed = parseMarkdown(content);
  if (!parsed) return content;

  const lines = content.split(/\r?\n/);
  let closingFrontmatter = -1;
  let markers = 0;

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i] === "---") {
      markers += 1;
      if (markers === 2) {
        closingFrontmatter = i;
        break;
      }
    }
  }

  if (closingFrontmatter === -1) return content;

  const tail = lines.slice(closingFrontmatter + 1).join("\n");
  const prefix = lines.slice(0, closingFrontmatter + 1).join("\n");
  return `${prefix}\n\n${body.trim()}\n`;
}

function cleanupMarkdownFile(content) {
  const parsed = parseMarkdown(content);
  if (!parsed) {
    return { changed: false, content };
  }

  const body = sanitizeRichArtifacts(parsed.body);
  const messageId =
    parsed.metadata.telegram_message_id || parsed.metadata.id || "post";
  const title = getTitle(body, messageId);

  let next = replaceBody(content, body);
  next = replaceFrontmatterTitle(next, title);
  next = removeObjectTag(next);

  return {
    changed: next !== content,
    content: next
  };
}

/**
 * Clean [object Object] artifacts from archived markdown posts.
 * @param {Object} config
 * @param {Object} [options]
 */
export async function backfillRichTextArtifacts(config, options = {}) {
  const { dryRun = false } = options;
  const vaultPath = path.resolve(process.cwd(), config.vaultPath);
  const mdFiles = await getMarkdownFiles(vaultPath);
  const summary = {
    scanned: mdFiles.length,
    candidates: 0,
    updated: 0
  };

  for (const filePath of mdFiles) {
    const original = await fs.readFile(filePath, "utf8");
    if (!needsRichCleanup(original)) continue;

    summary.candidates += 1;
    const { changed, content } = cleanupMarkdownFile(original);
    if (!changed) continue;

    if (!dryRun) {
      await fs.writeFile(filePath, content, "utf8");
      log(`[RichBackfill] Cleaned ${path.relative(process.cwd(), filePath)}`);
    }

    summary.updated += 1;
  }

  if (!dryRun && summary.updated > 0) {
    await exportVaultToWebsite(config);
  }

  return summary;
}