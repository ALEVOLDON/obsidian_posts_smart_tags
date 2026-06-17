import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractFileIdRefs,
  needsFileIdBackfill,
  replaceFileIdsInMarkdown
} from "../src/lib/fileIdRefs.js";

const PHOTO_ID = "AgACAgIAAx0CT0EpfgACCqJp3kMP9CMSSQ4gYpbFdBHA6IMf9wACYBdrG";
const VIDEO_ID = "BAACAgIAAx0CT0EpfgACCzlqBgqP61vJJOGuS7CWwRuenPUc2QACS6kAAoHzMUgZGMc7daiOFDsE";

describe("extractFileIdRefs", () => {
  it("collects markdown and media section file ids", () => {
    const refs = extractFileIdRefs(`
![Photo](file_id:${PHOTO_ID})
## Media
Photo file_id: ${PHOTO_ID}
Video file_id: ${VIDEO_ID}
`);

    assert.equal(refs.length, 2);
    assert.deepEqual(
      refs.map((item) => item.fileId),
      [PHOTO_ID, VIDEO_ID]
    );
    assert.equal(refs[1].mediaType, "video");
  });
});

describe("replaceFileIdsInMarkdown", () => {
  it("replaces markdown links and media section lines", () => {
    const updated = replaceFileIdsInMarkdown(
      `![Cover](fileid:${PHOTO_ID})\nPhoto file_id: ${PHOTO_ID}`,
      { [PHOTO_ID]: "https://alevoldon.com/media/telegram/test.jpg" }
    );

    assert.match(updated, /!\[Cover\]\(https:\/\/alevoldon\.com\/media\/telegram\/test\.jpg\)/);
    assert.match(updated, /- \[photo\]\(https:\/\/alevoldon\.com\/media\/telegram\/test\.jpg\)/);
  });
});

describe("needsFileIdBackfill", () => {
  it("detects legacy placeholders", () => {
    assert.equal(needsFileIdBackfill(`![Photo](file_id:${PHOTO_ID})`), true);
    assert.equal(needsFileIdBackfill(`Photo file_id: ${PHOTO_ID}`), true);
    assert.equal(needsFileIdBackfill("![Photo](https://alevoldon.com/media/x.jpg)"), false);
  });
});