import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { loadConfig } from "../lib/config.js";
import { getMarkdownFiles, parseMarkdown } from "../lib/exporter.js";

async function main() {
  const config = await loadConfig();
  const vaultPath = path.resolve(process.cwd(), config.vaultPath);
  const mdFiles = await getMarkdownFiles(vaultPath);

  const byMessageId = new Map();
  const byId = new Map();
  const byTitleDate = new Map();

  for (const filePath of mdFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = parseMarkdown(content);
    if (!parsed) continue;

    const rel = path.relative(vaultPath, filePath);
    const messageId = String(
      parsed.metadata.telegram_message_id || parsed.metadata.id || ""
    );
    const id = String(parsed.metadata.id || "");
    const title = String(parsed.metadata.title || "").trim();
    const date = String(parsed.metadata.date || "").slice(0, 16);
    const titleDateKey = `${date}::${title.toLowerCase()}`;

    if (messageId) {
      if (!byMessageId.has(messageId)) byMessageId.set(messageId, []);
      byMessageId.get(messageId).push(rel);
    }

    if (id) {
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push(rel);
    }

    if (title && date) {
      if (!byTitleDate.has(titleDateKey)) byTitleDate.set(titleDateKey, []);
      byTitleDate.get(titleDateKey).push(rel);
    }
  }

  const dupMessageIds = [...byMessageId.entries()].filter(([, files]) => files.length > 1);
  const dupIds = [...byId.entries()].filter(([, files]) => files.length > 1);
  const dupTitleDate = [...byTitleDate.entries()].filter(([, files]) => files.length > 1);

  let postsJsonCount = 0;
  let dupJsonMessageIds = [];
  if (config.websitePath) {
    const postsFile = path.resolve(config.websitePath, "public/data/posts.json");
    const raw = await fs.readFile(postsFile, "utf8");
    const { posts } = JSON.parse(raw);
    postsJsonCount = posts.length;

    const jsonByMsg = new Map();
    for (const post of posts) {
      const key = String(post.telegram_message_id || post.id);
      if (!jsonByMsg.has(key)) jsonByMsg.set(key, []);
      jsonByMsg.get(key).push(post.id);
    }
    dupJsonMessageIds = [...jsonByMsg.entries()].filter(([, ids]) => ids.length > 1);
  }

  console.log("\nDuplicate scan summary");
  console.log("======================");
  console.log(`Vault markdown files: ${mdFiles.length}`);
  console.log(`Duplicate telegram_message_id in vault: ${dupMessageIds.length}`);
  console.log(`Duplicate id in vault: ${dupIds.length}`);
  console.log(`Duplicate title+date in vault: ${dupTitleDate.length}`);
  console.log(`posts.json entries: ${postsJsonCount}`);
  console.log(`Duplicate telegram_message_id in posts.json: ${dupJsonMessageIds.length}`);

  if (dupMessageIds.length) {
    console.log("\nVault duplicates by telegram_message_id (first 20):");
    for (const [messageId, files] of dupMessageIds.slice(0, 20)) {
      console.log(`  ${messageId}: ${files.join(" | ")}`);
    }
  }

  if (dupTitleDate.length) {
    console.log("\nVault duplicates by title+date (first 20):");
    for (const [key, files] of dupTitleDate.slice(0, 20)) {
      console.log(`  ${key}`);
      for (const file of files) console.log(`    - ${file}`);
    }
  }

  if (dupJsonMessageIds.length) {
    console.log("\nposts.json duplicates by telegram_message_id (first 20):");
    for (const [messageId, ids] of dupJsonMessageIds.slice(0, 20)) {
      console.log(`  ${messageId}: post ids ${ids.join(", ")}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});