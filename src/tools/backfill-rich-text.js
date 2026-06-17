import process from "node:process";
import { loadConfig } from "../lib/config.js";
import { backfillRichTextArtifacts } from "../lib/richBackfill.js";
import { log } from "../lib/utils.js";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const config = await loadConfig();

  log(`[RichBackfill] Starting${dryRun ? " (dry-run)" : ""}`);
  const summary = await backfillRichTextArtifacts(config, { dryRun });

  console.log("\nRich text cleanup summary:");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});