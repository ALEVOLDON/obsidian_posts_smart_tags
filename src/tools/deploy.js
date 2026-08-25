import { loadConfig } from "../lib/config.js";
import { exportVaultToWebsite } from "../lib/exporter.js";
import { deployWebsiteBatch } from "../lib/siteDeploy.js";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

async function main() {
  try {
    const config = await loadConfig();

    if (!config.websitePath) {
      console.error("Error: websitePath is not configured in config.json!");
      process.exit(1);
    }

    // Auto-sync latest posts from TV Box before deployment
    if (process.platform === 'win32') {
      const syncScript = path.join('C:', 'Users', 'alevo', 'Desktop', 'H96_TV_Box_Project', 'sync_posts_from_box.py');
      if (fs.existsSync(syncScript)) {
        console.log("\n🔄 Step 1/3: Checking & syncing latest posts from TV Box...");
        try {
          execSync(`python "${syncScript}"`, { stdio: 'inherit' });
        } catch (e) {
          console.warn("⚠️ TV Box sync skipped or offline, proceeding with local vault.");
        }
      }
    }

    console.log("\n📦 Step 2/3: Exporting Obsidian vault to posts.json...");
    await exportVaultToWebsite(config);

    console.log("🚀 Step 3/3: Deploying posts.json and media to the live website...");
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