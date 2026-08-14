import { SocksProxyAgent } from "socks-proxy-agent";
import https from "node:https";
import { log } from "./utils.js";

/**
 * Execute a Telegram Bot API method.
 * @param {string} botToken
 * @param {string} method
 * @param {Object} params
 * @returns {Promise<any>}
 */
export async function apiCall(botToken, method, params = {}) {
  const url = new URL(`https://api.telegram.org/bot${botToken}/${method}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null)
      url.searchParams.set(key, String(value));
  });

  const reqOptions = { method: "GET" };
  if (process.env.SOCKS_PROXY) {
    reqOptions.agent = new SocksProxyAgent(process.env.SOCKS_PROXY);
  }

  return new Promise((resolve, reject) => {
    const req = https.request(url, reqOptions, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (!json.ok) {
            return reject(new Error(`Telegram API ${method} error: ${json.description || "unknown"}`));
          }
          resolve(json.result);
        } catch (e) {
          reject(new Error(`Failed to parse Telegram API response: ${e.message}`));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
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
