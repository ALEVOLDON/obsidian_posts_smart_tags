const MEDIA_FILE_NAME = {
  photo: "photo.jpg",
  video: "video.mp4",
  animation: "animation.gif",
  audio: "audio.mp3",
  voice: "voice.ogg",
  document: "file.bin"
};

function defaultFileName(mediaType) {
  return MEDIA_FILE_NAME[mediaType] || "file.bin";
}

function addRef(refs, seen, fileId, mediaType) {
  const normalized = String(fileId || "").trim();
  if (!normalized || seen.has(normalized)) return;
  seen.add(normalized);
  refs.push({
    fileId: normalized,
    mediaType: mediaType || "photo",
    fileName: defaultFileName(mediaType)
  });
}

/**
 * Extract Telegram file_id references from archived markdown.
 * @param {string} content
 * @returns {Array<{ fileId: string, mediaType: string, fileName: string }>}
 */
export function extractFileIdRefs(content) {
  const refs = [];
  const seen = new Set();

  for (const match of String(content || "").matchAll(
    /!\[[^\]]*\]\((?:file_id|fileid):([A-Za-z0-9_-]{20,220})\)?/gi
  )) {
    addRef(refs, seen, match[1], "photo");
  }

  for (const match of String(content || "").matchAll(
    /(?:^|[\s(])(?:file_id|fileid):([A-Za-z0-9_-]{20,220})/gi
  )) {
    addRef(refs, seen, match[1], "photo");
  }

  for (const match of String(content || "").matchAll(
    /(Photo|Video|Animation|Audio|Voice|Document)\s+file_id:\s*([A-Za-z0-9_-]{20,220})/gi
  )) {
    addRef(refs, seen, match[2], match[1].toLowerCase());
  }

  for (const match of String(content || "").matchAll(
    /Sticker:[^\n|]*\|\s*file_id:\s*([A-Za-z0-9_-]{20,220})/gi
  )) {
    addRef(refs, seen, match[1], "document");
  }

  return refs;
}

/**
 * @param {string} content
 * @returns {boolean}
 */
export function needsFileIdBackfill(content) {
  return /(?:file_id|fileid):\s*[A-Za-z0-9_-]{20,220}/i.test(String(content || ""));
}

/**
 * Replace legacy file_id placeholders with hosted URLs.
 * @param {string} content
 * @param {Record<string, string>} urlByFileId
 * @returns {string}
 */
export function replaceFileIdsInMarkdown(content, urlByFileId) {
  let result = String(content || "");

  result = result.replace(
    /!\[([^\]]*)\]\((?:file_id|fileid):([A-Za-z0-9_-]{20,220})\)?/gi,
    (match, alt, fileId) => {
      const url = urlByFileId[fileId];
      return url ? `![${alt || "Photo"}](${url})` : match;
    }
  );

  result = result.replace(
    /(Photo|Video|Animation|Audio|Voice|Document)\s+file_id:\s*([A-Za-z0-9_-]{20,220})/gi,
    (match, type, fileId) => {
      const url = urlByFileId[fileId];
      return url ? `- [${type.toLowerCase()}](${url})` : match;
    }
  );

  result = result.replace(
    /Sticker:([^\n|]*)\|\s*file_id:\s*([A-Za-z0-9_-]{20,220})/gi,
    (match, _label, fileId) => {
      const url = urlByFileId[fileId];
      return url ? `- [sticker](${url})` : match;
    }
  );

  return result;
}