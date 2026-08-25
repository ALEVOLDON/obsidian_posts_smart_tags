import path from "node:path";
import process from "node:process";
import { exists, readJson, writeJson } from "./utils.js";

const ROOT = process.cwd();
const STATE_PATH = path.join(ROOT, "state.json");

/**
 * Load sync state from state.json.
 * @returns {Promise<Object>}
 */
export async function loadState() {
  if (!(await exists(STATE_PATH))) {
    const initial = { lastUpdateId: 0, messages: {}, mediaByFileId: {} };
    await writeJson(STATE_PATH, initial);
    return initial;
  }
  try {
    const data = await readJson(STATE_PATH);
    if (!data.messages || typeof data.messages !== 'object') {
      data.messages = {};
    }
    if (typeof data.lastUpdateId !== 'number') {
      data.lastUpdateId = 0;
    }
    return data;
  } catch (err) {
    console.error(`[State] Warning: state.json was corrupted (${err.message}). Creating backup and recovering...`);
    try {
      const fs = await import("node:fs/promises");
      await fs.copyFile(STATE_PATH, `${STATE_PATH}.corrupt.${Date.now()}`);
    } catch {}
    const initial = { lastUpdateId: 0, messages: {}, mediaByFileId: {} };
    await writeJson(STATE_PATH, initial);
    return initial;
  }
}

/**
 * Save sync state to state.json.
 * @param {Object} state
 */
export async function saveState(state) {
  await writeJson(STATE_PATH, state);
}
