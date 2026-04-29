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
    const initial = { lastUpdateId: 0, messages: {} };
    await writeJson(STATE_PATH, initial);
    return initial;
  }
  return readJson(STATE_PATH);
}

/**
 * Save sync state to state.json.
 * @param {Object} state
 */
export async function saveState(state) {
  await writeJson(STATE_PATH, state);
}
