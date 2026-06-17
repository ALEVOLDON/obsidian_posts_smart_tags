import {
  extractPlainText,
  htmlToMarkdown,
  prepareNoteBody,
  richMarkdownToText,
  sanitizeRichArtifacts
} from "./richText.js";

function renderMediaBlock(block, mediaType, urlByFileId) {
  const fileId = block?.[mediaType]?.file_id;
  if (!fileId) return "";

  if (urlByFileId[fileId]) {
    const label = mediaType.charAt(0).toUpperCase() + mediaType.slice(1);
    return `![${label}](${urlByFileId[fileId]})\n\n`;
  }

  return `![${mediaType}](file_id:${fileId})\n\n`;
}

/**
 * Convert a rich message block into Markdown format.
 * @param {Object} block
 * @returns {string}
 */
function richBlockToMarkdown(block, urlByFileId = {}) {
  if (!block) return "";

  switch (block.type) {
    case "heading":
    case "subheading": {
      const level = block.size || (block.type === "subheading" ? 2 : 1);
      const text = extractPlainText(block.text || block.content);
      return text ? `${"#".repeat(level)} ${text}\n\n` : "";
    }
    case "paragraph":
    case "text": {
      const text = extractPlainText(block.text || block.content);
      return text ? `${text}\n\n` : "";
    }
    case "preformatted":
    case "code": {
      const lang = block.language || "";
      const text = extractPlainText(block.text || block.content);
      return text ? `\`\`\`${lang}\n${text}\n\`\`\`\n\n` : "";
    }
    case "block_quote":
    case "quotation": {
      const text = extractPlainText(block.text || block.content);
      return text ? `> ${text}\n\n` : "";
    }
    case "divider": {
      return "---\n\n";
    }
    case "photo": {
      const photo = block.photo?.at(-1);
      if (photo?.file_id && urlByFileId[photo.file_id]) {
        return `![Photo](${urlByFileId[photo.file_id]})\n\n`;
      }
      if (photo?.file_id) {
        return `![Photo](file_id:${photo.file_id})\n\n`;
      }
      return "";
    }
    case "video":
      return renderMediaBlock(block, "video", urlByFileId);
    case "animation":
      return renderMediaBlock(block, "animation", urlByFileId);
    case "document":
      return renderMediaBlock(block, "document", urlByFileId);
    case "table": {
      const rows = block.cells || block.rows;
      if (!rows || rows.length === 0) return "";

      let markdown = "";

      rows.forEach((rowObj, rowIndex) => {
        const cells = Array.isArray(rowObj) ? rowObj : rowObj.cells || [];

        markdown += `| ${cells
          .map((cell) => extractPlainText(cell))
          .join(" | ")} |\n`;

        if (rowIndex === 0) {
          markdown += `| ${cells
            .map((cell) => {
              const align =
                typeof cell === "string" ? "left" : cell.align || "left";
              if (align === "center") return " :---: ";
              if (align === "right") return " ---: ";
              return " :--- ";
            })
            .join(" | ")} |\n`;
        }
      });

      return `${markdown}\n`;
    }
    case "list":
    case "ordered_list":
    case "unordered_list": {
      const items = block.items || [];
      const isOrdered = Boolean(
        block.ordered || block.type === "ordered_list"
      );
      let markdown = "";

      items.forEach((item, index) => {
        const itemText = extractPlainText(
          typeof item === "string" ? item : item.text || item.content || item
        );
        if (!itemText) return;

        const prefix = isOrdered ? `${index + 1}. ` : "- ";
        markdown += `${prefix}${itemText}\n`;
      });

      return markdown ? `${markdown}\n` : "";
    }
    default: {
      const text = extractPlainText(
        block.text || block.content || block.children
      );
      return text ? `${text}\n\n` : "";
    }
  }
}

/**
 * Replace legacy file_id markdown placeholders with hosted URLs.
 * @param {string} text
 * @param {Record<string, string>} urlByFileId
 * @returns {string}
 */
function replaceFileIdMarkdown(text, urlByFileId) {
  return String(text || "").replace(
    /!\[([^\]]*)\]\(file_id:([^)]+)\)/g,
    (match, alt, fileId) =>
      urlByFileId[fileId]
        ? `![${alt || "Photo"}](${urlByFileId[fileId]})`
        : match
  );
}

/**
 * Extract text or caption from a message.
 * @param {Object} message
 * @returns {string}
 */
export function extractText(message, urlByFileId = {}) {
  const rich = message.rich_message;
  let text = "";

  if (rich) {
    if (Array.isArray(rich.blocks) && rich.blocks.length > 0) {
      text = rich.blocks
        .map((block) => richBlockToMarkdown(block, urlByFileId))
        .join("");
    } else if (rich.markdown != null) {
      text = richMarkdownToText(rich.markdown);
    } else if (rich.html) {
      text = htmlToMarkdown(rich.html);
    }
  }

  if (!text) {
    text = String(message.text || message.caption || "");
  }

  return replaceFileIdMarkdown(sanitizeRichArtifacts(text.trim()), urlByFileId);
}

/**
 * Generate a title for the post.
 * @param {string} text
 * @param {number} messageId
 * @returns {string}
 */
export function getTitle(text, messageId) {
  const cleaned = sanitizeRichArtifacts(text);
  let firstLine = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return `Post ${messageId}`;

  firstLine = firstLine
    .replace(/^#+\s+/, "")
    .replace(/\*\*|__|\*|_/g, "")
    .trim();

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
export function getMediaSummary(hostedMedia = []) {
  return hostedMedia
    .filter((item) => item.publicUrl)
    .map((item) => `- [${item.mediaType}](${item.publicUrl})`);
}

function buildUrlMap(hostedMedia) {
  return Object.fromEntries(
    hostedMedia
      .filter((item) => item.publicUrl)
      .map((item) => [item.fileId, item.publicUrl])
  );
}

function prependCoverImage(text, hostedMedia) {
  const cover = hostedMedia.find(
    (item) => item.publicUrl && item.mediaType === "photo"
  );
  if (!cover || text.includes(cover.publicUrl)) {
    return text;
  }
  return `![Post cover](${cover.publicUrl})\n\n${text}`;
}

/**
 * Render the Markdown content for a post.
 * @param {Object} params
 * @returns {string}
 */
export function renderMarkdown({ channelTitle, message, tags, hostedMedia = [] }) {
  const urlByFileId = buildUrlMap(hostedMedia);
  let text = extractText(message, urlByFileId);
  text = prependCoverImage(text, hostedMedia);
  const title = getTitle(text, message.message_id);
  const links = getLinks(text);
  const media = getMediaSummary(hostedMedia);
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
  lines.push("---", "");

  const body = prepareNoteBody(text, title);
  if (body) {
    lines.push(body, "");
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

export { sanitizeRichArtifacts };