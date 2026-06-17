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

/**
 * Commit and push multiple files inside the website repository in one commit.
 * @param {Object} config
 * @param {string[]} absoluteFilePaths
 * @returns {{ pushed: boolean }}
 */
export function deployWebsiteFiles(config, absoluteFilePaths) {
  const repoPath = path.resolve(config.websitePath);
  const relativePaths = [
    ...new Set(
      absoluteFilePaths
        .map((filePath) =>
          path.relative(repoPath, path.resolve(filePath)).replace(/\\/g, "/")
        )
        .filter((relativePath) => relativePath && !relativePath.startsWith(".."))
    )
  ];

  if (!relativePaths.length) {
    return { pushed: false };
  }

  log(`[Deploy] Staging ${relativePaths.length} file(s)...`);

  try {
    execSync("git --version", { stdio: "ignore" });
  } catch {
    throw new Error("Git is not available in PATH");
  }

  for (const relativePath of relativePaths) {
    execSync(`git add "${relativePath}"`, { cwd: repoPath, stdio: "pipe" });
  }

  const status = execSync("git status --porcelain", {
    cwd: repoPath,
    encoding: "utf8"
  }).trim();

  if (!status) {
    log("[Deploy] No changes to push");
    return { pushed: false };
  }

  execSync('git commit -m "sync: backfill media and website data from telegram bot"', {
    cwd: repoPath,
    stdio: "pipe"
  });
  execSync("git push", { cwd: repoPath, stdio: "pipe" });
  log("[Deploy] Batch changes pushed; Vercel redeploy started");

  return { pushed: true };
}

const DAILY_DEPLOY_PATHS = ["public/data/posts.json", "public/media"];

/**
 * Daily batch deploy for deploy_posts.bat.
 * Stages posts.json and website media in a single commit.
 * @param {Object} config
 * @returns {{ pushed: boolean }}
 */
export function deployWebsiteBatch(config) {
  const repoPath = path.resolve(config.websitePath);

  if (!repoPath) {
    throw new Error("websitePath is not configured");
  }

  log(`[Deploy] Preparing daily batch deploy in ${repoPath}`);

  try {
    execSync("git --version", { stdio: "ignore" });
  } catch {
    throw new Error("Git is not available in PATH");
  }

  for (const relativePath of DAILY_DEPLOY_PATHS) {
    execSync(`git add "${relativePath}"`, { cwd: repoPath, stdio: "pipe" });
  }

  const status = execSync("git status --porcelain", {
    cwd: repoPath,
    encoding: "utf8"
  }).trim();

  if (!status) {
    log("[Deploy] No changes to push (posts.json and media are up to date)");
    return { pushed: false };
  }

  execSync('git commit -m "data: sync posts and media from obsidian vault"', {
    cwd: repoPath,
    stdio: "pipe"
  });
  execSync("git push", { cwd: repoPath, stdio: "pipe" });
  log("[Deploy] Daily batch pushed; Vercel redeploy started");

  return { pushed: true };
}