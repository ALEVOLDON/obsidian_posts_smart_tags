import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { apiCall } from "./telegram.js";
import { deployWebsiteFile } from "./siteDeploy.js";
import { log } from "./utils.js";

const EXTENSION_BY_MEDIA_TYPE = {
  photo: ".jpg",
  video: ".mp4",
  animation: ".gif",
  document: ".bin",
  audio: ".mp3",
  voice: ".ogg"
};

export function isMediaStorageConfigured(config) {
  return Boolean(config.mediaStorageDir && config.mediaPublicBaseUrl);
}

function sanitizeExtension(fileName, mediaType) {
  const fromName = path.extname(fileName || "").toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/.test(fromName)) {
    return fromName;
  }
  return EXTENSION_BY_MEDIA_TYPE[mediaType] || ".bin";
}

export function buildStoredFileName(mediaType, fileName) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const suffix = crypto.randomBytes(4).toString("hex");
  const ext = sanitizeExtension(fileName, mediaType);
  return path.posix.join("telegram", year, month, `${stamp}-${suffix}${ext}`);
}

export function buildPublicMediaUrl(config, storedRelativePath) {
  const base = config.mediaPublicBaseUrl.replace(/\/$/, "");
  const normalized = String(storedRelativePath).replace(/\\/g, "/").replace(/^\/+/, "");
  return `${base}/${normalized}`;
}

/**
 * Collect unique Telegram media attachments from a channel post.
 * @param {Object} message
 * @returns {Array<{ fileId: string, mediaType: string, fileName: string }>}
 */
export function collectMediaItems(message) {
  const seen = new Set();
  const items = [];

  function add(fileId, mediaType, fileName) {
    if (!fileId || seen.has(fileId)) return;
    seen.add(fileId);
    items.push({ fileId, mediaType, fileName });
  }

  if (message.photo?.length) {
    add(message.photo.at(-1).file_id, "photo", "photo.jpg");
  }
  if (message.video) {
    add(message.video.file_id, "video", message.video.file_name || "video.mp4");
  }
  if (message.animation) {
    add(message.animation.file_id, "animation", message.animation.file_name || "animation.gif");
  }
  if (message.document) {
    add(message.document.file_id, "document", message.document.file_name || "document.dat");
  }
  if (message.audio) {
    add(message.audio.file_id, "audio", message.audio.file_name || "audio.mp3");
  }
  if (message.voice) {
    add(message.voice.file_id, "voice", "voice.ogg");
  }

  if (Array.isArray(message.rich_message?.blocks)) {
    for (const block of message.rich_message.blocks) {
      if (block.type === "photo" && block.photo?.length) {
        add(block.photo.at(-1).file_id, "photo", "photo.jpg");
      }
      if (block.type === "video" && block.video?.file_id) {
        add(block.video.file_id, "video", block.video.file_name || "video.mp4");
      }
      if (block.type === "animation" && block.animation?.file_id) {
        add(block.animation.file_id, "animation", block.animation.file_name || "animation.gif");
      }
    }
  }

  return items;
}

async function downloadTelegramFile(botToken, fileId) {
  const file = await apiCall(botToken, "getFile", { file_id: fileId });
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download Telegram file: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function saveMediaBuffer(config, buffer, mediaType, fileName) {
  const relativePath = buildStoredFileName(mediaType, fileName);
  const absolutePath = path.join(config.mediaStorageDir, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);
  return { absolutePath, relativePath };
}

async function hostSingleMedia(config, botToken, item) {
  const buffer = await downloadTelegramFile(botToken, item.fileId);
  const saved = await saveMediaBuffer(config, buffer, item.mediaType, item.fileName);
  const publicUrl = buildPublicMediaUrl(config, saved.relativePath);

  let deployed = false;
  if (config.mediaAutoDeploy && config.websitePath) {
    const result = deployWebsiteFile(config, saved.absolutePath);
    deployed = result.pushed;
  }

  return {
    ...item,
    publicUrl,
    absolutePath: saved.absolutePath,
    relativePath: saved.relativePath,
    deployed
  };
}

/**
 * Download and host all media from a channel post.
 * @param {Object} config
 * @param {Object} state
 * @param {Object} message
 * @returns {Promise<Array>}
 */
export async function hostMessageMedia(config, state, message) {
  if (!isMediaStorageConfigured(config)) {
    return [];
  }

  state.mediaByFileId = state.mediaByFileId || {};
  const items = collectMediaItems(message);
  const hosted = [];

  for (const item of items) {
    const cachedUrl = state.mediaByFileId[item.fileId];
    if (cachedUrl) {
      hosted.push({ ...item, publicUrl: cachedUrl, deployed: false, cached: true });
      continue;
    }

    try {
      const result = await hostSingleMedia(config, config.botToken, item);
      state.mediaByFileId[item.fileId] = result.publicUrl;
      hosted.push(result);
      log(`[Media] Hosted ${item.mediaType}: ${result.publicUrl}`);
    } catch (error) {
      log(`[Media] Failed to host ${item.mediaType} (${item.fileId}): ${error.message}`);
    }
  }

  return hosted;
}