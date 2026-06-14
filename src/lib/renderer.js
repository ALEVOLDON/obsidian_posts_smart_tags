/**
 * Extract text or caption from a message.
 * @param {Object} message
 * @returns {string}
 */
/**
 * Convert a rich message block into Markdown format.
 * @param {Object} block
 * @returns {string}
 */
function richBlockToMarkdown(block) {
  if (!block) return "";

  switch (block.type) {
    case "heading": {
      const level = block.size || 1;
      return "#".repeat(level) + " " + (block.text || "") + "\n\n";
    }
    case "paragraph": {
      return (block.text || "") + "\n\n";
    }
    case "preformatted":
    case "code": {
      const lang = block.language || "";
      return "```" + lang + "\n" + (block.text || "") + "\n```\n\n";
    }
    case "block_quote":
    case "quotation": {
      return "> " + (block.text || "") + "\n\n";
    }
    case "divider": {
      return "---\n\n";
    }
    case "photo": {
      const photo = block.photo?.at(-1);
      if (photo && photo.file_id) {
        return `![Photo](file_id:${photo.file_id})\n\n`;
      }
      return "";
    }
    case "table": {
      const rows = block.cells || block.rows;
      if (!rows || rows.length === 0) return "";

      let markdown = "";

      rows.forEach((rowObj, rowIndex) => {
        const cells = Array.isArray(rowObj) ? rowObj : (rowObj.cells || []);

        markdown += "| " + cells.map(cell => {
          if (typeof cell === "string") return cell;
          return cell.text || "";
        }).join(" | ") + " |\n";

        if (rowIndex === 0) {
          markdown += "| " + cells.map(cell => {
            const align = typeof cell === "string" ? "left" : (cell.align || "left");
            if (align === "center") return " :---: ";
            if (align === "right") return " ---: ";
            return " :--- ";
          }).join(" | ") + " |\n";
        }
      });

      return markdown + "\n";
    }
    case "list": {
      const items = block.items || [];
      const isOrdered = block.ordered || false;
      let markdown = "";

      items.forEach((item, index) => {
        let itemText = "";
        if (typeof item === "string") {
          itemText = item;
        } else if (item.text) {
          itemText = item.text;
        } else if (item.content) {
          if (typeof item.content === "string") {
            itemText = item.content;
          } else if (item.content.text) {
            itemText = item.content.text;
          }
        }

        const prefix = isOrdered ? `${index + 1}. ` : "- ";
        markdown += prefix + itemText + "\n";
      });

      return markdown + "\n";
    }
    default:
      if (block.text) {
        return block.text + "\n\n";
      }
      return "";
  }
}

/**
 * Extract text or caption from a message.
 * @param {Object} message
 * @returns {string}
 */
export function extractText(message) {
  if (message.rich_message) {
    if (message.rich_message.markdown) {
      return String(message.rich_message.markdown).trim();
    }
    if (Array.isArray(message.rich_message.blocks)) {
      return message.rich_message.blocks.map(b => richBlockToMarkdown(b)).join("").trim();
    }
  }
  return String(message.text || message.caption || "").trim();
}

/**
 * Generate a title for the post.
 * @param {string} text
 * @param {number} messageId
 * @returns {string}
 */
export function getTitle(text, messageId) {
  let firstLine = text
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

  // Extract media from rich message blocks if any
  if (message.rich_message && Array.isArray(message.rich_message.blocks)) {
    message.rich_message.blocks.forEach(block => {
      if (block.type === "photo" && block.photo?.length) {
        const photo = block.photo.at(-1);
        sections.push(`Photo file_id: ${photo.file_id}`);
      }
      if (block.type === "video" && block.video) {
        sections.push(`Video file_id: ${block.video.file_id}`);
      }
      if (block.type === "animation" && block.animation) {
        sections.push(`Animation file_id: ${block.animation.file_id}`);
      }
    });
  }

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
