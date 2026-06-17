import process from "node:process";
import { loadConfig } from "../lib/config.js";
import { backfillDuplicateHeadings } from "../lib/headingBackfill.js";
import { log } from "../lib/utils.js";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const config = await loadConfig();

  log(`[Headings] Starting duplicate heading cleanup${dryRun ? " (dry-run)" : ""}`);
  const summary = await backfillDuplicateHeadings(config, { dryRun });

  console.log("\nHeading cleanup summary:");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});