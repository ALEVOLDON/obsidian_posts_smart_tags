import { sanitizeTag } from "./utils.js";

/**
 * Extract hashtags from text.
 * @param {string} text
 * @returns {string[]}
 */
export function getHashtags(text) {
  return [...text.matchAll(/(?<![\p{L}\p{N}_])#([\p{L}\p{N}_-]+)/gu)]
    .map((match) => sanitizeTag(match[1]))
    .filter(Boolean);
}

/**
 * Map URLs to domain-based tags.
 * @param {string[]} links
 * @returns {string[]}
 */
export function getDomainTags(links) {
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
    ["t.me", ["telegram"]],
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

/**
 * Identify topic tags based on regex rules.
 * @param {string} text
 * @returns {string[]}
 */
export function getTopicTags(text) {
  const lower = text.toLowerCase();
  const rules = [
    [
      "frontend",
      /(frontend|front end|front-end|html|css|javascript|typescript|react|vue|angular|svelte|webpack|vite|next\.js|tailwind)/,
    ],
    [
      "backend",
      /(backend|back end|back-end|api|node\.js|express|django|flask|laravel|spring|postgres|mysql|mongodb|redis)/,
    ],
    [
      "design",
      /(design|ui|ux|figma|dribbble|behance|typography|layout|prototype|mockup)/,
    ],
    [
      "job",
      /(vacancy|job|hiring|remote|full[- ]time|part[- ]time|salary|role overview|apply)/,
    ],
    [
      "learning",
      /(course|courses|learn|learning|tutorial|academy|bootcamp|guide|roadmap)/,
    ],
    [
      "ai",
      /(^|[^a-z])(ai|ml|llm|gpt|openai|neural)([^a-z]|$)|machine learning/,
    ],
    ["security", /(security|cyber|vpn|kali|hack|hacking|infosec|pentest)/],
    ["video", /(youtube|video|stream|trailer|recording)/],
    ["3d", /(3d|blender|cinema 4d|render|modeling|animation|nft)/],
    ["mobile", /(android|ios|react native|flutter|mobile|apk)/],
    ["telegram", /(telegram|t\.me)/],
    ["tools", /(tool|tools|devtools|plugin|extension|editor|ide|utility)/],
  ];

  return rules.filter(([, regex]) => regex.test(lower)).map(([tag]) => tag);
}

/**
 * Extract tags from frequently used keywords.
 * @param {string} text
 * @param {string[]} existing
 * @returns {string[]}
 */
export function getKeywordTags(text, existing) {
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "that", "this", "your", "you", "are", "not", "but", "all",
    "new", "use", "using", "into", "over", "more", "best", "free", "than", "today", "start", "learn",
    "developer", "developers", "frontend", "web", "https", "http", "www", "com", "org", "net", "ru",
    "post", "archive", "tags", "links", "media", "channel", "public_channel", "watch", "utm", "source",
    "campaign", "content", "medium", "html", "css", "js", "telegram", "live", "sync"
  ]);

  const used = new Set(existing);
  const counts = new Map();
  const matches =
    text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_+-]{2,}/gu) || [];
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

/**
 * Build a complete list of tags for a post.
 * @param {string} text
 * @param {string[]} links
 * @param {string[]} baseTags
 * @returns {string[]}
 */
export function buildTags(text, links, baseTags) {
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
