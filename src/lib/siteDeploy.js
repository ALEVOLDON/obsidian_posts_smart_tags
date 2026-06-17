import { execSync } from "node:child_process";
import path from "node:path";
import { log } from "./utils.js";

/**
 * Commit and push a file inside the website repository.
 * @param {Object} config
 * @param {string} absoluteFilePath
 * @returns {{ pushed: boolean }}
 */
export function deployWebsiteFile(config, absoluteFilePath) {
  const repoPath = path.resolve(config.websitePath);
  const relativePath = path.relative(repoPath, path.resolve(absoluteFilePath)).replace(/\\/g, "/");

  if (!relativePath || relativePath.startsWith("..")) {
    throw new Error("Target file is outside websitePath");
  }

  log(`[Deploy] Staging ${relativePath}...`);

  try {
    execSync("git --version", { stdio: "ignore" });
  } catch {
    throw new Error("Git is not available in PATH");
  }

  execSync(`git add "${relativePath}"`, { cwd: repoPath, stdio: "pipe" });

  const status = execSync(`git status --porcelain "${relativePath}"`, {
    cwd: repoPath,
    encoding: "utf8"
  }).trim();

  if (!status) {
    log("[Deploy] No changes to push");
    return { pushed: false };
  }

  execSync('git commit -m "sync: update website data from telegram bot"', {
    cwd: repoPath,
    stdio: "pipe"
  });
  execSync("git push", { cwd: repoPath, stdio: "pipe" });
  log("[Deploy] Changes pushed; Vercel redeploy started");

  return { pushed: true };
}