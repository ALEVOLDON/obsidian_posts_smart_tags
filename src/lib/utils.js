import fs from "node:fs/promises";
import path from "node:path";

/**
 * Log a message with a timestamp.
 * @param {string} message
 */
export function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

/**
 * Check if a file or directory exists.
 * @param {string} target
 * @returns {Promise<boolean>}
 */
export async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse a JSON file.
 * @param {string} filePath
 * @returns {Promise<any>}
 */
export async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

/**
 * Write an object to a JSON file.
 * @param {string} filePath
 * @param {any} value
 */
export async function writeJson(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

/**
 * Create a URL-friendly slug from a string.
 * @param {string} input
 * @param {string} fallback
 * @returns {string}
 */
export function slugify(input, fallback = "post") {
  const cleaned = String(input || "")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return cleaned || fallback;
}

/**
 * Sanitize a string for use as a tag.
 * @param {string} tag
 * @returns {string|null}
 */
export function sanitizeTag(tag) {
  const cleaned = String(tag || "")
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || null;
}

/**
 * Ensure a directory exists for a given file path.
 * @param {string} targetPath
 */
export async function ensureDir(targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
}
