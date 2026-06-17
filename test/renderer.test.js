import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractText, renderMarkdown } from "../src/lib/renderer.js";

describe("extractText media urls", () => {
  it("replaces file_id markdown with hosted urls", () => {
    const text = extractText(
      { text: "![Cover](file_id:AgACAgIAAx0CT0EpfgACCqJp3kMP9CMSSQ4gYpbFdBHA6IMf9wACYBdrG)" },
      {
        AgACAgIAAx0CT0EpfgACCqJp3kMP9CMSSQ4gYpbFdBHA6IMf9wACYBdrG:
          "https://alevoldon.com/media/telegram/test.jpg"
      }
    );
    assert.match(text, /!\[Cover\]\(https:\/\/alevoldon\.com\/media\/telegram\/test\.jpg\)/);
  });
});

describe("renderMarkdown", () => {
  it("embeds hosted photo into markdown body", () => {
    const markdown = renderMarkdown({
      channelTitle: "DUMP",
      message: {
        message_id: 42,
        date: 1710000000,
        chat: { id: -1001 },
        photo: [{ file_id: "photo1" }],
        caption: "Hello world"
      },
      tags: ["telegram-import"],
      hostedMedia: [
        {
          fileId: "photo1",
          mediaType: "photo",
          publicUrl: "https://alevoldon.com/media/telegram/2026/06/cover.jpg"
        }
      ]
    });

    assert.match(markdown, /!\[Post cover\]\(https:\/\/alevoldon\.com\/media\/telegram\/2026\/06\/cover\.jpg\)/);
    assert.match(markdown, /## Media/);
    assert.match(markdown, /\[photo\]\(https:\/\/alevoldon\.com\/media\/telegram\/2026\/06\/cover\.jpg\)/);
  });
});