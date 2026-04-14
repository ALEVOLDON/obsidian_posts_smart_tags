import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "config.json");
const CONFIG_EXAMPLE_PATH = path.join(ROOT, "config.example.json");
const STATE_PATH = path.join(ROOT, "state.json");

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function slugify(input, fallback = "post") {
  const cleaned = String(input || "")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return cleaned || fallback;
}

function sanitizeTag(tag) {
  const cleaned = String(tag || "")
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || null;
}

function extractText(message) {
  return String(message.text || message.caption || "").trim();
}

function getTitle(text, messageId) {
  const firstLine = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (!firstLine) return `Post ${messageId}`;
  return firstLine.length > 80 ? `${firstLine.slice(0, 80).trim()}...` : firstLine;
}

function getLinks(text) {
  return [...text.matchAll(/https?:\/\/[^\s)\]]+/g)].map((match) => match[0]);
}

function getHashtags(text) {
  return [...text.matchAll(/(?<![\p{L}\p{N}_])#([\p{L}\p{N}_-]+)/gu)]
    .map((match) => sanitizeTag(match[1]))
    .filter(Boolean);
}

function getDomainTags(links) {
  const map = new Map([
    ["youtube", ["youtube", "video"]],
    ["youtu", ["youtube", "video"]],
    ["github", ["github", "code"]],
    ["gitlab", ["gitlab", "code"]],
    ["figma", ["figma", "design"]],
    ["dribbble", ["design", "inspiration"]],
    ["behance", ["design", "inspiration"]],
    ["coursera", ["learning", "course"]],
    ["udemy", ["learning", "course"]],
    ["edx", ["learning", "course"]],
    ["scrimba", ["learning", "frontend"]],
    ["codecademy", ["learning", "code"]],
    ["telegram", ["telegram"]],
    ["t.me", ["telegram"]]
  ]);

  const tags = [];
  for (const link of links) {
    try {
      const url = new URL(link);
      const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
      const parts = host.split(".");
      const root = parts.length >= 2 ? parts.at(-2) : parts[0];
      const mapped = map.get(host) || map.get(root);
      if (mapped) {
        tags.push(...mapped);
      } else {
        const tag = sanitizeTag(root);
        if (tag) tags.push(tag);
      }
    } catch {
      continue;
    }
  }
  return tags;
}

function getTopicTags(text) {
  const lower = text.toLowerCase();
  const rules = [
    ["frontend", /(frontend|front end|front-end|html|css|javascript|typescript|react|vue|angular|svelte|webpack|vite|next\.js|tailwind)/],
    ["backend", /(backend|back end|back-end|api|node\.js|express|django|flask|laravel|spring|postgres|mysql|mongodb|redis)/],
    ["design", /(design|ui|ux|figma|dribbble|behance|typography|layout|prototype|mockup)/],
    ["job", /(vacancy|job|hiring|remote|full[- ]time|part[- ]time|salary|role overview|apply)/],
    ["learning", /(course|courses|learn|learning|tutorial|academy|bootcamp|guide|roadmap)/],
    ["ai", /(^|[^a-z])(ai|ml|llm|gpt|openai|neural)([^a-z]|$)|machine learning/],
    ["security", /(security|cyber|vpn|kali|hack|hacking|infosec|pentest)/],
    ["video", /(youtube|video|stream|trailer|recording)/],
    ["3d", /(3d|blender|cinema 4d|render|modeling|animation|nft)/],
    ["mobile", /(android|ios|react native|flutter|mobile|apk)/],
    ["telegram", /(telegram|t\.me)/],
    ["tools", /(tool|tools|devtools|plugin|extension|editor|ide|utility)/]
  ];

  return rules.filter(([, regex]) => regex.test(lower)).map(([tag]) => tag);
}

function getKeywordTags(text, existing) {
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "that", "this", "your", "you", "are", "not", "but", "all",
    "new", "use", "using", "into", "over", "more", "best", "free", "than", "today", "start", "learn",
    "developer", "developers", "frontend", "web", "https", "http", "www", "com", "org", "net", "ru",
    "post", "archive", "tags", "links", "media", "channel", "public_channel", "watch", "utm", "source",
    "campaign", "content", "medium", "html", "css", "js", "telegram", "live", "sync"
  ]);

  const used = new Set(existing);
  const counts = new Map();
  const matches = text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_+-]{2,}/gu) || [];
  for (const word of matches) {
    if (stopWords.has(word)) continue;
    if (/^\d+$/.test(word)) continue;
    if (/^[a-z0-9]{8,}$/.test(word)) continue;
    if (/^\d+[a-z0-9_-]*$/.test(word)) continue;
    if (/^[a-z0-9_-]{1,3}$/.test(word)) continue;
    const tag = sanitizeTag(word);
    if (!tag || used.has(tag)) continue;
    counts.set(tag, (counts.get(tag) || 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([tag]) => tag);
}

function buildTags(text, links, baseTags) {
  const tags = [];
  const seen = new Set();
  const push = (tag) => {
    const normalized = sanitizeTag(tag);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    tags.push(normalized);
  };

  for (const tag of baseTags) push(tag);
  for (const tag of getHashtags(text)) push(tag);
  for (const tag of getTopicTags(text)) push(tag);
  for (const tag of getDomainTags(links)) push(tag);
  for (const tag of getKeywordTags(text, tags)) push(tag);

  if (tags.length < 3) {
    push("post");
    push("archive");
  }

  return tags;
}

function getMediaSummary(message) {
  const sections = [];

  if (message.photo?.length) {
    const photo = message.photo.at(-1);
    sections.push(`Photo file_id: ${photo.file_id}`);
  }
  if (message.video) sections.push(`Video file_id: ${message.video.file_id}`);
  if (message.document) sections.push(`Document: ${message.document.file_name || "document"} | file_id: ${message.document.file_id}`);
  if (message.audio) sections.push(`Audio file_id: ${message.audio.file_id}`);
  if (message.voice) sections.push(`Voice file_id: ${message.voice.file_id}`);
  if (message.animation) sections.push(`Animation file_id: ${message.animation.file_id}`);
  if (message.sticker) sections.push(`Sticker: ${message.sticker.emoji || ""} | file_id: ${message.sticker.file_id}`.trim());

  return sections;
}

function renderMarkdown({ channelTitle, message, tags }) {
  const text = extractText(message);
  const title = getTitle(text, message.message_id);
  const links = getLinks(text);
  const media = getMediaSummary(message);
  const hashLine = tags.map((tag) => `#${tag}`).join(" ");

  const lines = [
    "---",
    `id: ${message.message_id}`,
    `date: \"${new Date(message.date * 1000).toISOString()}\"`,
    `channel: \"${String(channelTitle || "Telegram Channel").replaceAll('"', '\\"')}\"`,
    `telegram_chat_id: \"${message.chat.id}\"`,
    `telegram_message_id: ${message.message_id}`,
    `title: \"${title.replaceAll('"', '\\"')}\"`,
    "tags:"
  ];

  for (const tag of tags) lines.push(`  - ${tag}`);
  lines.push("---", "", `# ${title}`, "");

  if (text) {
    lines.push(text, "");
  }

  if (media.length) {
    lines.push("## Media", "", ...media, "");
  }

  if (links.length) {
    lines.push("## Links", "");
    for (const link of [...new Set(links)]) lines.push(`- ${link}`);
    lines.push("");
  }

  lines.push("## Tags", "", hashLine, "");
  return lines.join("\n");
}

function buildFilePath(vaultPath, message, title) {
  const date = new Date(message.date * 1000);
  const year = String(date.getUTCFullYear());
  const fileName = `${year}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}_${String(date.getUTCHours()).padStart(2, "0")}-${String(date.getUTCMinutes()).padStart(2, "0")}-${String(date.getUTCSeconds()).padStart(2, "0")}_${slugify(title)}_id-${message.message_id}.md`;
  return path.join(vaultPath, year, fileName);
}

async function ensureDir(targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
}

async function loadConfig() {
  if (!(await exists(CONFIG_PATH))) {
    throw new Error(`config.json not found. Copy ${path.basename(CONFIG_EXAMPLE_PATH)} to config.json and fill your values.`);
  }

  const config = await readJson(CONFIG_PATH);
  const botToken = process.env.TELEGRAM_BOT_TOKEN || config.botToken;
  const channelChatId = process.env.TELEGRAM_CHANNEL_CHAT_ID || config.channelChatId;
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH || config.vaultPath || "./obsidian_posts_live";
  const pollTimeoutSec = Number(process.env.TELEGRAM_POLL_TIMEOUT_SEC || config.pollTimeoutSec || 25);
  const pollIntervalMs = Number(process.env.TELEGRAM_POLL_INTERVAL_MS || config.pollIntervalMs || 1500);

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
    baseTags: Array.isArray(config.baseTags) ? config.baseTags : ["telegram-import", "live-sync"]
  };
}

async function loadState() {
  if (!(await exists(STATE_PATH))) {
    const initial = { lastUpdateId: 0, messages: {} };
    await writeJson(STATE_PATH, initial);
    return initial;
  }
  return readJson(STATE_PATH);
}

async function saveState(state) {
  await writeJson(STATE_PATH, state);
}

async function apiCall(botToken, method, params) {
  const url = new URL(`https://api.telegram.org/bot${botToken}/${method}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Telegram API ${method} failed with ${response.status}`);
  }

  const json = await response.json();
  if (!json.ok) {
    throw new Error(`Telegram API ${method} error: ${json.description || "unknown error"}`);
  }

  return json.result;
}

async function getChannelTitle(botToken, chatId) {
  try {
    const chat = await apiCall(botToken, "getChat", { chat_id: chatId });
    return chat.title || chat.username || "Telegram Channel";
  } catch (error) {
    log(`Could not load channel title: ${error.message}`);
    return "Telegram Channel";
  }
}

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
    edited: Boolean(message.edit_date)
  };
}

function pickTelegramMessage(update) {
  return update.channel_post || update.edited_channel_post || null;
}

async function processUpdate(config, state, channelTitle, update) {
  const message = pickTelegramMessage(update);
  if (!message) return;
  if (String(message.chat.id) !== String(config.channelChatId)) return;

  await writeMessageToVault(config, state, channelTitle, message);
  const status = update.edited_channel_post ? "updated" : "created";
  log(`${status} post ${message.message_id}`);
}

async function main() {
  const config = await loadConfig();
  const state = await loadState();
  const channelTitle = await getChannelTitle(config.botToken, config.channelChatId);

  await fs.mkdir(config.vaultPath, { recursive: true });
  log(`Vault path: ${config.vaultPath}`);
  log(`Listening for Telegram posts from ${config.channelChatId}`);

  while (true) {
    try {
      const updates = await apiCall(config.botToken, "getUpdates", {
        offset: state.lastUpdateId + 1,
        timeout: config.pollTimeoutSec,
        allowed_updates: JSON.stringify(["channel_post", "edited_channel_post"])
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
      await new Promise((resolve) => setTimeout(resolve, Math.max(config.pollIntervalMs, 3000)));
    }

    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
