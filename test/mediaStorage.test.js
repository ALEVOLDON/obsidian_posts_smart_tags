import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPublicMediaUrl,
  buildStoredFileName,
  collectMediaItems,
  isMediaStorageConfigured
} from "../src/lib/mediaStorage.js";

describe("collectMediaItems", () => {
  it("collects photo and video attachments", () => {
    const items = collectMediaItems({
      photo: [{ file_id: "p1" }, { file_id: "p2" }],
      video: { file_id: "v1", file_name: "clip.mp4" }
    });

    assert.equal(items.length, 2);
    assert.equal(items[0].fileId, "p2");
    assert.equal(items[1].mediaType, "video");
  });
});

describe("buildPublicMediaUrl", () => {
  it("builds absolute media urls", () => {
    const url = buildPublicMediaUrl(
      { mediaPublicBaseUrl: "https://alevoldon.com/media" },
      "telegram/2026/06/file.jpg"
    );
    assert.equal(url, "https://alevoldon.com/media/telegram/2026/06/file.jpg");
  });
});

describe("buildStoredFileName", () => {
  it("stores files under telegram/year/month", () => {
    const stored = buildStoredFileName("photo", "cover.png");
    assert.match(stored, /^telegram\/\d{4}\/\d{2}\/.+\.png$/);
  });
});

describe("isMediaStorageConfigured", () => {
  it("requires storage path and public base url", () => {
    assert.equal(
      isMediaStorageConfigured({
        mediaStorageDir: "/tmp/media",
        mediaPublicBaseUrl: "https://alevoldon.com/media"
      }),
      true
    );
  });
});