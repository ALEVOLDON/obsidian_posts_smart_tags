import { loadConfig } from "../lib/config.js";
import { exportVaultToWebsite } from "../lib/exporter.js";

async function run() {
  const config = await loadConfig();
  await exportVaultToWebsite(config);
  console.log("One-time export completed successfully.");
}

run().catch(console.error);
