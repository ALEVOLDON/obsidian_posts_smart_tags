import { apiCall } from "./telegram.js";

async function telegramRequest(botToken, method, params) {
  const url = new URL(`https://api.telegram.org/bot${botToken}/${method}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, { method: "GET" });
  const json = await response.json();
  return json;
}

/**
 * Check whether a channel post still exists without reposting it publicly.
 * Uses a silent forward to verifyChatId, then deletes the forwarded copy.
 * @param {Object} options
 * @param {string} options.botToken
 * @param {string|number} options.channelChatId
 * @param {number|string} options.messageId
 * @param {string|number} options.verifyChatId
 * @returns {Promise<boolean>}
 */
export async function channelPostExists({
  botToken,
  channelChatId,
  messageId,
  verifyChatId,
}) {
  const json = await telegramRequest(botToken, "forwardMessage", {
    chat_id: verifyChatId,
    from_chat_id: channelChatId,
    message_id: messageId,
    disable_notification: true,
  });

  if (!json.ok) {
    const description = String(json.description || "").toLowerCase();
    if (
      description.includes("message to forward not found") ||
      description.includes("message not found") ||
      description.includes("message_id_invalid")
    ) {
      return false;
    }
    throw new Error(`Telegram forwardMessage error: ${json.description}`);
  }

  await telegramRequest(botToken, "deleteMessage", {
    chat_id: verifyChatId,
    message_id: json.result.message_id,
  });

  return true;
}