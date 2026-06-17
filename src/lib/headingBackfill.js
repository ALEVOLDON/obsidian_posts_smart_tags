import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { exportVaultToWebsite, getMarkdownFiles, parseMarkdown } from "./exporter.js";
import { getTitle } from "./renderer.js";
import { dedupeLeadingHeadings } from "./richText.js";
import { log } from "./utils.js";

function replaceFrontmatterTitle(content, title) {
  const escaped = title.replaceAll('"', '\\"');
  return content.replace(
    /^title:\s*(".*"|'.*'|[^\n]+)/m,
    `title: "${escaped}"`
  );
}

function replaceBody(content, body) {
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

  let insertAt = closingFrontmatter + 1;
  while (insertAt < lines.length && !lines[insertAt].trim()) {
    insertAt += 1;
  }

  const prefix = lines.slice(0, insertAt).join("\n");
  return `${prefix}\n\n${body.trim()}\n`;
}

function cleanupDuplicateHeadings(content) {
  const parsed = parseMarkdown(content);
  if (!parsed) return { changed: false, content };

  const messageId =
    parsed.metadata.telegram_message_id || parsed.metadata.id || "post";
  const title =
    parsed.metadata.title || getTitle(parsed.body, messageId);
  const body = dedupeLeadingHeadings(parsed.body, title);
  if (body.trim() === parsed.body.trim()) {
    return { changed: false, content };
  }

  let next = replaceBody(content, body);
  next = replaceFrontmatterTitle(next, getTitle(body, messageId));

  return {
    changed: true,
    content: next
  };
}

/**
 * Remove duplicate headings from all archived markdown notes.
 * @param {Object} config
 * @param {Object} [options]
 */
export async function backfillDuplicateHeadings(config, options = {}) {
  const { dryRun = false } = options;
  const vaultPath = path.resolve(process.cwd(), config.vaultPath);
  const mdFiles = await getMarkdownFiles(vaultPath);
  const summary = { scanned: mdFiles.length, updated: 0 };

  for (const filePath of mdFiles) {
    const original = await fs.readFile(filePath, "utf8");
    const { changed, content } = cleanupDuplicateHeadings(original);
    if (!changed) continue;

    summary.updated += 1;
    if (!dryRun) {
      await fs.writeFile(filePath, content, "utf8");
      log(`[Headings] Cleaned ${path.relative(process.cwd(), filePath)}`);
    }
  }

  if (!dryRun && summary.updated > 0) {
    await exportVaultToWebsite(config);
  }

  return summary;
}