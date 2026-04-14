import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const configPath = path.join(process.cwd(), "config.json");

const raw = await fs.readFile(configPath, "utf8");
const config = JSON.parse(raw.replace(/^\uFEFF/, ""));
if (!config.botToken || config.botToken === "PASTE_YOUR_BOT_TOKEN_HERE") {
  throw new Error("Fill botToken in config.json first.");
}

const url = `https://api.telegram.org/bot${config.botToken}/getUpdates?timeout=1`;
const response = await fetch(url);
const data = await response.json();
console.log(JSON.stringify(data, null, 2));
