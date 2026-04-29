/**
 * Extract text or caption from a message.
 * @param {Object} message
 * @returns {string}
 */
export function extractText(message) {
  return String(message.text || message.caption || "").trim();
}

/**
 * Generate a title for the post.
 * @param {string} text
 * @param {number} messageId
 * @returns {string}
 */
export function getTitle(text, messageId) {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return `Post ${messageId}`;
  return firstLine.length > 80
    ? `${firstLine.slice(0, 80).trim()}...`
    : firstLine;
}

/**
 * Extract URLs from text.
 * @param {string} text
 * @returns {string[]}
 */
export function getLinks(text) {
  return [...text.matchAll(/https?:\/\/[^\s)\]]+/g)].map((match) => match[0]);
}

/**
 * Build a summary of media attachments.
 * @param {Object} message
 * @returns {string[]}
 */
export function getMediaSummary(message) {
  const sections = [];

  if (message.photo?.length) {
    const photo = message.photo.at(-1);
    sections.push(`Photo file_id: ${photo.file_id}`);
  }
  if (message.video) sections.push(`Video file_id: ${message.video.file_id}`);
  if (message.document)
    sections.push(
      `Document: ${message.document.file_name || "document"} | file_id: ${
        message.document.file_id
      }`
    );
  if (message.audio) sections.push(`Audio file_id: ${message.audio.file_id}`);
  if (message.voice) sections.push(`Voice file_id: ${message.voice.file_id}`);
  if (message.animation)
    sections.push(`Animation file_id: ${message.animation.file_id}`);
  if (message.sticker)
    sections.push(
      `Sticker: ${message.sticker.emoji || ""} | file_id: ${
        message.sticker.file_id
      }`.trim()
    );

  return sections;
}

/**
 * Render the Markdown content for a post.
 * @param {Object} params
 * @returns {string}
 */
export function renderMarkdown({ channelTitle, message, tags }) {
  const text = extractText(message);
  const title = getTitle(text, message.message_id);
  const links = getLinks(text);
  const media = getMediaSummary(message);
  const hashLine = tags.map((tag) => `#${tag}`).join(" ");

  const lines = [
    "---",
    `id: ${message.message_id}`,
    `date: \"${new Date(message.date * 1000).toISOString()}\"`,
    `channel: \"${String(channelTitle || "Telegram Channel").replaceAll(
      '"',
      '\\"'
    )}\"`,
    `telegram_chat_id: \"${message.chat.id}\"`,
    `telegram_message_id: ${message.message_id}`,
    `title: \"${title.replaceAll('"', '\\"')}\"`,
    "tags:",
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
