import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractText } from "../src/lib/renderer.js";
import {
  extractPlainText,
  htmlToMarkdown,
  richMarkdownToText,
  sanitizeRichArtifacts
} from "../src/lib/richText.js";

describe("extractPlainText", () => {
  it("flattens nested rich markdown nodes", () => {
    const text = extractPlainText([
      "⚡️ ",
      { text: "Hello" },
      { content: [{ text: " world" }] }
    ]);
    assert.equal(text, "⚡️ Hello world");
  });
});

describe("richMarkdownToText", () => {
  it("does not stringify objects as object Object", () => {
    const text = richMarkdownToText([
      "ASUS ",
      { text: "Grace" },
      ", ",
      { content: { text: "Blackwell" } }
    ]);
    assert.equal(text, "ASUS Grace, Blackwell");
    assert.doesNotMatch(text, /\[object Object\]/);
  });
});

describe("htmlToMarkdown", () => {
  it("converts rich html posts into readable text", () => {
    const text = htmlToMarkdown(
      '<h1>Title</h1><p>Line one</p><img src="https://alevoldon.com/media/x.jpg" />'
    );
    assert.match(text, /Title/);
    assert.match(text, /Line one/);
    assert.match(text, /!\[\]\(https:\/\/alevoldon\.com\/media\/x\.jpg\)/);
  });
});

describe("sanitizeRichArtifacts", () => {
  it("removes object Object noise and empty list items", () => {
    const text = sanitizeRichArtifacts(
      "[object Object], ASUS update ,[object Object],\n-\n-\nFinal line"
    );
    assert.match(text, /ASUS update/);
    assert.match(text, /Final line/);
    assert.doesNotMatch(text, /\[object Object\]/);
  });
});

describe("extractText rich_message", () => {
  it("prefers blocks over broken markdown arrays", () => {
    const text = extractText({
      rich_message: {
        markdown: ["Broken ", { text: "ignored when blocks exist" }],
        blocks: [
          { type: "heading", size: 1, text: "ASUS AI Workstation" },
          {
            type: "list",
            items: [{ text: "Local LLM" }, { content: { text: "Training" } }]
          }
        ]
      }
    });

    assert.match(text, /# ASUS AI Workstation/);
    assert.match(text, /- Local LLM/);
    assert.match(text, /- Training/);
    assert.doesNotMatch(text, /\[object Object\]/);
  });

  it("falls back to html when markdown is absent", () => {
    const text = extractText({
      rich_message: {
        html: "<p>Hello <b>world</b></p>"
      }
    });
    assert.equal(text, "Hello world");
  });
});