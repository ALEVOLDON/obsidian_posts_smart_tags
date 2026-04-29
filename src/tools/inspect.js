import { loadConfig } from "../lib/config.js";

async function main() {
  try {
    const config = await loadConfig();
    const url = `https://api.telegram.org/bot${config.botToken}/getUpdates?timeout=1`;
    const response = await fetch(url);
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
