import { log } from "./utils.js";

/**
 * Execute a Telegram Bot API method.
 * @param {string} botToken
 * @param {string} method
 * @param {Object} params
 * @returns {Promise<any>}
 */
export async function apiCall(botToken, method, params) {
  const url = new URL(`https://api.telegram.org/bot${botToken}/${method}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null)
      url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Telegram API ${method} failed with ${response.status}`);
  }

  const json = await response.json();
  if (!json.ok) {
    throw new Error(
      `Telegram API ${method} error: ${json.description || "unknown error"}`
    );
  }

  return json.result;
}

/**
 * Get the title or username of a Telegram chat.
 * @param {string} botToken
 * @param {string|number} chatId
 * @returns {Promise<string>}
 */
export async function getChannelTitle(botToken, chatId) {
  try {
    const chat = await apiCall(botToken, "getChat", { chat_id: chatId });
    return chat.title || chat.username || "Telegram Channel";
  } catch (error) {
    log(`Could not load channel title: ${error.message}`);
    return "Telegram Channel";
  }
}
