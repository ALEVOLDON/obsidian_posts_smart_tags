import fs from "node:fs/promises";
import path from "node:path";
import {
  dedupeLeadingHeadings,
  stripHeadingMatchingTitle
} from "./richText.js";
import { log } from "./utils.js";

/**
 * Parses frontmatter and body from markdown content.
 */
export function parseMarkdown(content) {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0 || lines[0] !== "---") return null;

  let i = 1;
  const frontmatterText = [];
  while (i < lines.length && lines[i] !== "---") {
    frontmatterText.push(lines[i]);
    i++;
  }

  if (i >= lines.length) return null; // Unclosed frontmatter

  const body = lines.slice(i + 1).join("\n").trim();

  // Parse frontmatter lines
  const metadata = {};
  let currentKey = null;

  for (const line of frontmatterText) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if it's a list item under a key (e.g. tags)
    if (trimmed.startsWith("-") && currentKey) {
      if (!Array.isArray(metadata[currentKey])) {
        metadata[currentKey] = [];
      }
      // Remove leading dash and quotes if present
      const itemVal = trimmed
        .replace(/^-\s*/, "")
        .replace(/^"(.*)"$/, "$1")
        .replace(/^'(.*)'$/, "$1");
      metadata[currentKey].push(itemVal);
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Remove quotes
    value = value.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");

    // Parse types
    if (value === "true") {
      value = true;
    } else if (value === "false") {
      value = false;
    } else if (!isNaN(value) && value !== "") {
      value = Number(value);
    }

    metadata[key] = value;
    currentKey = key;
  }

  return { metadata, body };
}

/**
 * Recursively find all markdown files in a directory.
 */
export async function getMarkdownFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const res = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === ".obsidian" || entry.name.startsWith(".")) {
            return [];
          }
          return getMarkdownFiles(res);
        }
        return entry.name.endsWith(".md") ? [res] : [];
      })
    );
    return files.flat();
  } catch (error) {
    log(`Error reading directory ${dir}: ${error.message}`);
    return [];
  }
}

/**
 * Scan vault and write compiled posts to website repository.
 */
export async function exportVaultToWebsite(config) {
  if (!config.websitePath) {
    log("Skipping export: websitePath not configured in config.json");
    return;
  }

  const vaultPath = path.resolve(process.cwd(), config.vaultPath);
  log(`Scanning vault for export: ${vaultPath}`);

  const mdFiles = await getMarkdownFiles(vaultPath);
  log(`Found ${mdFiles.length} markdown files in vault.`);

  const posts = [];

  for (const filePath of mdFiles) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      const parsed = parseMarkdown(content);
      if (!parsed || !parsed.metadata || !parsed.metadata.id) {
        // Skip files that don't have proper metadata/id
        continue;
      }

      const title = parsed.metadata.title || `Post ${parsed.metadata.id}`;
      const body = dedupeLeadingHeadings(parsed.body, title);

      posts.push({
        id: parsed.metadata.id,
        date: parsed.metadata.date || new Date().toISOString(),
        title,
        channel: parsed.metadata.channel || "Telegram Channel",
        telegram_chat_id: parsed.metadata.telegram_chat_id || "",
        telegram_message_id: parsed.metadata.telegram_message_id || parsed.metadata.id,
        tags: parsed.metadata.tags || [],
        content: stripHeadingMatchingTitle(body, title),
      });
    } catch (err) {
      log(`Error parsing file ${path.basename(filePath)}: ${err.message}`);
    }
  }

  // Sort posts by date descending
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  const targetDir = path.resolve(config.websitePath, "public/data");
  const targetFile = path.join(targetDir, "posts.json");

  try {
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(targetFile, JSON.stringify({ posts }, null, 2), "utf8");
    log(`Successfully exported ${posts.length} posts to ${targetFile}`);
  } catch (err) {
    log(`Failed to write exported JSON to ${targetFile}: ${err.message}`);
  }
}
