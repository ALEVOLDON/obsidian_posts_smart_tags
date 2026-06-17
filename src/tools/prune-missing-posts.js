import process from "node:process";
import { loadConfig } from "../lib/config.js";
import { pruneMissingPosts } from "../lib/pruneMissingPosts.js";
import { loadState, saveState } from "../lib/state.js";
import { log } from "../lib/utils.js";

function readArg(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return "";
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const since = readArg("since");
  const limit = Number(readArg("limit") || 0);
  const config = await loadConfig();
  const state = await loadState();

  log(
    `[Prune] Checking vault against Telegram channel${dryRun ? " (dry-run)" : ""}${
      since ? ` since ${since}` : ""
    }`
  );

  const summary = await pruneMissingPosts(config, state, {
    dryRun,
    since,
    limit,
  });

  if (!dryRun && summary.missing > 0) {
    await saveState(state);
  }

  console.log("\nPrune summary:");
  console.log(JSON.stringify(summary, null, 2));

  if (summary.removed.length) {
    console.log("\nMissing posts:");
    for (const entry of summary.removed) {
      console.log(`  ${entry.messageId} ${entry.date} ${entry.title}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});