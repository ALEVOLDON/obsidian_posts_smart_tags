import process from "node:process";
import { backfillVaultMedia } from "../lib/backfill.js";
import { loadConfig } from "../lib/config.js";
import { loadState, saveState } from "../lib/state.js";
import { log } from "../lib/utils.js";

function readFlag(name) {
  return process.argv.includes(name);
}

function readOption(name, fallback) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (!match) return fallback;
  const value = match.slice(prefix.length);
  if (value === "") return fallback;
  return value;
}

async function main() {
  const dryRun = readFlag("--dry-run");
  const deploy = readFlag("--deploy");
  const limit = Number(readOption("--limit", "0"));
  const delayMs = Number(readOption("--delay", "300"));

  const config = await loadConfig();
  const state = await loadState();

  log(
    `[Backfill] Starting${dryRun ? " (dry-run)" : ""}${deploy ? " with deploy" : ""}`
  );

  const summary = await backfillVaultMedia(config, state, {
    dryRun,
    deploy,
    delayMs,
    limit: limit > 0 ? limit : Infinity
  });

  if (!dryRun) {
    await saveState(state);
  }

  console.log("\nBackfill summary:");
  console.log(JSON.stringify(summary, null, 2));

  if (dryRun) {
    console.log("\nDry-run only. Re-run without --dry-run to apply changes.");
  } else if (!deploy && (summary.hosted > 0 || summary.updated > 0)) {
    console.log(
      "\nLocal files updated. Run with --deploy to push media + posts.json to the website repo."
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});