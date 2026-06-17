import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { loadConfig } from "../lib/config.js";
import { getMarkdownFiles, parseMarkdown } from "../lib/exporter.js";

function normalizeTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bodyFingerprint(body) {
  return String(body || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

async function main() {
  const since = process.argv[2] || "2026-06-16";
  const config = await loadConfig();
  const vaultPath = path.resolve(process.cwd(), config.vaultPath);
  const mdFiles = await getMarkdownFiles(vaultPath);
  const recent = [];

  for (const filePath of mdFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = parseMarkdown(content);
    if (!parsed?.metadata?.date) continue;
    if (!String(parsed.metadata.date).startsWith(since)) continue;

    recent.push({
      file: path.relative(vaultPath, filePath),
      id: parsed.metadata.id,
      messageId: parsed.metadata.telegram_message_id || parsed.metadata.id,
      date: parsed.metadata.date,
      title: parsed.metadata.title || "",
      titleKey: normalizeTitle(parsed.metadata.title),
      bodyKey: bodyFingerprint(parsed.body),
    });
  }

  recent.sort((a, b) => new Date(b.date) - new Date(a.date));

  const byTitle = new Map();
  const byBody = new Map();

  for (const post of recent) {
    if (post.titleKey) {
      if (!byTitle.has(post.titleKey)) byTitle.set(post.titleKey, []);
      byTitle.get(post.titleKey).push(post);
    }
    if (post.bodyKey.length > 40) {
      if (!byBody.has(post.bodyKey)) byBody.set(post.bodyKey, []);
      byBody.get(post.bodyKey).push(post);
    }
  }

  const titleDups = [...byTitle.values()].filter((group) => group.length > 1);
  const bodyDups = [...byBody.values()].filter((group) => group.length > 1);

  console.log(`\nRecent posts since ${since}: ${recent.length}`);
  console.log(`Same normalized title: ${titleDups.length}`);
  console.log(`Same body fingerprint: ${bodyDups.length}`);

  if (titleDups.length) {
    console.log("\nTitle duplicates:");
    for (const group of titleDups) {
      console.log(`\n  "${group[0].title}"`);
      for (const post of group) {
        console.log(`    id=${post.id} msg=${post.messageId} ${post.date} -> ${post.file}`);
      }
    }
  }

  if (bodyDups.length) {
    console.log("\nBody duplicates:");
    for (const group of bodyDups) {
      console.log(`\n  "${group[0].title}"`);
      for (const post of group) {
        console.log(`    id=${post.id} msg=${post.messageId} ${post.date} -> ${post.file}`);
      }
    }
  }

  console.log("\nRecent posts list:");
  for (const post of recent.slice(0, 30)) {
    console.log(`  ${post.date} id=${post.id} ${post.title}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});