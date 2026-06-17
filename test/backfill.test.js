import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseMarkdown } from "../src/lib/exporter.js";
import { getTitle } from "../src/lib/renderer.js";
import { replaceFileIdsInMarkdown } from "../src/lib/fileIdRefs.js";

describe("backfill title repair", () => {
  it("rebuilds broken titles from body text", () => {
    const content = `---
id: 3049
title: "![Photo](fileid:AgACAgQAAxUAAWoxekZGbbIWarNCpl8mw3nyN7AAJbDmsbKZSNUS0xRP60BYedAQ..."
---

# ⚡️ Почему Telegram до сих пор не сделал свой фреймворк для постов?

Текст поста.
`;

    const parsed = parseMarkdown(content);
    const repaired = replaceFileIdsInMarkdown(content, {});
    const title = getTitle(parsed.body, 3049);
    const nextTitle = title.replaceAll('"', '\\"');
    const updated = repaired.replace(
      /^title:\s*(".*"|'.*'|[^\n]+)/m,
      `title: "${nextTitle}"`
    );

    assert.match(updated, /title: "⚡️ Почему Telegram до сих пор не сделал свой фреймворк для постов\?"/);
  });
});