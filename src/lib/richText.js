/**
 * Recursively extract plain text from Telegram rich message nodes.
 * @param {unknown} value
 * @returns {string}
 */
export function extractPlainText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => extractPlainText(item)).join("");
  }

  if (typeof value !== "object") return "";

  const node = value;
  if (node.text != null) return extractPlainText(node.text);
  if (node.plain_text != null) return extractPlainText(node.plain_text);
  if (node.content != null) return extractPlainText(node.content);
  if (node.markdown != null) return extractPlainText(node.markdown);
  if (node.value != null) return extractPlainText(node.value);
  if (node.url != null && node.type === "link") return extractPlainText(node.url);

  if (Array.isArray(node.children)) return extractPlainText(node.children);
  if (Array.isArray(node.runs)) return extractPlainText(node.runs);
  if (Array.isArray(node.entities)) return extractPlainText(node.entities);
  if (Array.isArray(node.items)) return extractPlainText(node.items);

  return "";
}

/**
 * Remove artifacts produced by String(object) conversions.
 * @param {string} text
 * @returns {string}
 */
export function sanitizeRichArtifacts(text) {
  return String(text || "")
    .replace(/,?\s*\[object Object\]\s*,?/g, " ")
    .replace(/^\s*#?\s*\[object Object\],\s*/gim, "")
    .replace(/^-\s*$/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Convert Telegram rich HTML into readable markdown-ish text.
 * @param {string} html
 * @returns {string}
 */
export function htmlToMarkdown(html) {
  let text = String(html || "");

  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, "![]($1)\n\n")
    .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

  return sanitizeRichArtifacts(text);
}

/**
 * Normalize rich_message.markdown values into plain text.
 * @param {unknown} markdown
 * @returns {string}
 */
export function richMarkdownToText(markdown) {
  if (typeof markdown === "string") {
    return sanitizeRichArtifacts(markdown);
  }
  return sanitizeRichArtifacts(extractPlainText(markdown));
}