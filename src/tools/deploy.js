import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  try {
    const configPath = path.resolve(process.cwd(), "config.json");
    const configText = await fs.readFile(configPath, "utf8");
    const config = JSON.parse(configText);

    if (!config.websitePath) {
      console.error("Error: websitePath is not configured in config.json!");
      process.exit(1);
    }

    const webPath = path.resolve(config.websitePath);
    console.log(`\n🚀 Starting deployment to live website...`);
    console.log(`📂 Website Directory: ${webPath}`);

    // Check if git is available
    try {
      execSync("git --version", { stdio: "ignore" });
    } catch {
      console.error("Error: Git command line tool not found or not in PATH!");
      process.exit(1);
    }

    // Stage posts.json
    console.log("Staging public/data/posts.json...");
    execSync("git add public/data/posts.json", { cwd: webPath });

    // Check if there are changes to commit
    const status = execSync("git status --porcelain public/data/posts.json", { cwd: webPath }).toString().trim();
    if (!status) {
      console.log("ℹ️ No new posts or changes to deploy. posts.json is already up-to-date!");
      return;
    }

    // Commit
    console.log("Creating commit...");
    execSync('git commit -m "data: sync posts from obsidian vault"', { cwd: webPath, stdio: "inherit" });

    // Push
    console.log("Pushing to GitHub...");
    execSync("git push", { cwd: webPath, stdio: "inherit" });

    console.log("\n✅ Success! Changes pushed. The live site is redeploying now!\n");
  } catch (err) {
    console.error(`\n❌ Deployment failed: ${err.message}\n`);
    process.exit(1);
  }
}

main();
