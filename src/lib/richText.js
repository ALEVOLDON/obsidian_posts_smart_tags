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

export function normalizeHeadingText(value) {
  return sanitizeRichArtifacts(value)
    .replace(/^#+\s+/, "")
    .replace(/\*\*|__|\*|_/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function headingsMatch(a, b) {
  const left = normalizeHeadingText(a);
  const right = normalizeHeadingText(b);
  if (!left || !right) return false;

  const minLen = Math.min(left.length, right.length, 48);
  return left.slice(0, minLen) === right.slice(0, minLen);
}

export function getLeadingHeadingLine(text) {
  const line = String(text || "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find(Boolean);

  if (!line || !/^#{1,6}\s+/.test(line)) return "";
  return line.replace(/^#{1,6}\s+/, "").trim();
}

function collapseBlankLines(text) {
  return String(text || "").replace(/\n{3,}/g, "\n\n").trim();
}

function stripLeadingPlainTitleRepeat(text, title = "") {
  const lines = String(text || "").split(/\r?\n/);
  let start = 0;

  while (start < lines.length && !lines[start].trim()) start += 1;
  if (start >= lines.length) return collapseBlankLines(text);

  const first = lines[start].trim();

  if (/^#{1,6}\s+/.test(first)) {
    const headingText = first.replace(/^#{1,6}\s+/, "").trim();
    let next = start + 1;

    while (next < lines.length && !lines[next].trim()) next += 1;
    if (next >= lines.length) return collapseBlankLines(text);

    const candidate = lines[next].trim();
    if (/^#{1,6}\s+/.test(candidate)) return collapseBlankLines(text);

    if (
      headingsMatch(candidate, headingText) ||
      (title && headingsMatch(candidate, title))
    ) {
      lines.splice(next, 1);
      return collapseBlankLines(lines.join("\n"));
    }

    return collapseBlankLines(text);
  }

  if (title && headingsMatch(first, title)) {
    lines.splice(start, 1);
    return collapseBlankLines(lines.join("\n"));
  }

  return collapseBlankLines(text);
}

/**
 * Remove duplicate markdown headings at the start of a note body.
 * @param {string} text
 * @param {string} [title]
 * @returns {string}
 */
export function dedupeLeadingHeadings(text, title = "") {
  let body = String(text || "").trim();
  if (!body) return "";

  body = body.replace(/^(#{1,6}\s+[^\n]+)\n+\1\b/im, "$1");

  const lines = body.split(/\r?\n/);
  const output = [];
  let index = 0;

  while (index < lines.length && !lines[index].trim()) index += 1;
  if (index >= lines.length) return "";

  const first = lines[index].trim();
  if (!/^#{1,6}\s+/.test(first)) {
    return body;
  }

  output.push(lines[index]);
  index += 1;

  while (index < lines.length && !lines[index].trim()) index += 1;
  if (index < lines.length) {
    const second = lines[index].trim();
    if (
      /^#{1,6}\s+/.test(second) &&
      (second === first ||
        headingsMatch(second, first) ||
        (title && headingsMatch(second, title)))
    ) {
      index += 1;
    }
  }

  while (index < lines.length && !lines[index].trim()) index += 1;
  if (index < lines.length) {
    output.push("");
    output.push(...lines.slice(index));
  }

  return stripLeadingPlainTitleRepeat(output.join("\n").trim(), title);
}

/**
 * Build note body with a single leading heading when needed.
 * @param {string} text
 * @param {string} title
 * @returns {string}
 */
export function prepareNoteBody(text, title) {
  let body = dedupeLeadingHeadings(text, title);
  if (!body) return title ? `# ${title}` : "";

  const leading = getLeadingHeadingLine(body);
  if (leading) return body;

  return `# ${title}\n\n${body}`;
}

/**
 * Remove a leading heading from rendered content when the UI already shows title.
 * @param {string} content
 * @param {string} title
 * @returns {string}
 */
export function stripHeadingMatchingTitle(content, title) {
  let body = String(content || "").trim();
  const leading = getLeadingHeadingLine(body);

  if (leading && headingsMatch(leading, title)) {
    body = body.replace(/^#{1,6}\s+[^\n]+\n*/, "").trimStart();
  }

  return stripLeadingPlainTitleRepeat(body, title);
}