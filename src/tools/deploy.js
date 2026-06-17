import { loadConfig } from "../lib/config.js";
import { exportVaultToWebsite } from "../lib/exporter.js";
import { deployWebsiteBatch } from "../lib/siteDeploy.js";

async function main() {
  try {
    const config = await loadConfig();

    if (!config.websitePath) {
      console.error("Error: websitePath is not configured in config.json!");
      process.exit(1);
    }

    console.log("\n📦 Step 1/2: Exporting Obsidian vault to posts.json...");
    await exportVaultToWebsite(config);

    console.log("🚀 Step 2/2: Deploying posts.json and media to the live website...");
    const result = deployWebsiteBatch(config);

    if (!result.pushed) {
      console.log("\nℹ️ Nothing new to deploy. Site is already up to date.\n");
      return;
    }

    console.log("\n✅ Success! Posts and media pushed. Vercel is redeploying now.\n");
  } catch (err) {
    console.error(`\n❌ Deployment failed: ${err.message}\n`);
    process.exit(1);
  }
}

main();