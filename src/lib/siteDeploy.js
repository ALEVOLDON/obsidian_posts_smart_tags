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

/**
 * Ensures the website repository is healthy, on branch main, and up to date with remote.
 * Automatically recovers from stuck rebases, detached HEAD, or diverged unpushed sync commits.
 * @param {Object} config
 */
export function prepareWebsiteRepo(config) {
  if (!config.websitePath) return;
  const repoPath = path.resolve(config.websitePath);

  log(`[Deploy] Ensuring repository is clean and ready in ${repoPath}...`);

  try {
    execSync("git --version", { stdio: "ignore" });
  } catch {
    throw new Error("Git is not available in PATH");
  }

  // 1. Abort any stuck rebase or merge
  try {
    execSync("git rebase --abort", { cwd: repoPath, stdio: "ignore" });
  } catch {}
  try {
    execSync("git merge --abort", { cwd: repoPath, stdio: "ignore" });
  } catch {}

  // 2. Ensure we are on branch main
  try {
    execSync("git checkout main", { cwd: repoPath, stdio: "ignore" });
  } catch (err) {
    log(`[Deploy] Note checking out main: ${err.message}`);
  }

  // 3. Fetch latest origin/main
  try {
    execSync("git fetch origin main", { cwd: repoPath, stdio: "pipe" });
  } catch (err) {
    log(`[Deploy] Warning: git fetch origin main: ${err.message}`);
    return;
  }

  // 4. Try fast-forward pull first
  try {
    execSync("git pull --ff-only origin main", { cwd: repoPath, stdio: "pipe" });
    log("[Deploy] Repository fast-forwarded to origin/main");
  } catch {
    // If fast-forward failed, check if local branch has unpushed diverged commits
    try {
      const divergedDiff = execSync("git diff origin/main..HEAD --name-only", {
        cwd: repoPath,
        encoding: "utf8"
      }).trim().split(/\r?\n/).filter(Boolean);

      // If diverged commits only touch generated data files (posts.json or media),
      // it is safe to reset hard to origin/main because posts.json will be freshly re-exported from vault
      const onlyDataFiles = divergedDiff.length === 0 || divergedDiff.every(file =>
        file === "public/data/posts.json" || file.startsWith("public/media/")
      );

      if (onlyDataFiles) {
        log("[Deploy] Diverged commits contain only generated data; resetting to origin/main before fresh export");
        execSync("git reset --hard origin/main", { cwd: repoPath, stdio: "pipe" });
      } else {
        execSync("git pull --rebase -X theirs origin main", { cwd: repoPath, stdio: "pipe" });
      }
    } catch (err) {
      log(`[Deploy] Warning reconciling with origin/main: ${err.message}`);
      try {
        execSync("git rebase --abort", { cwd: repoPath, stdio: "ignore" });
      } catch {}
    }
  }
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

  // Ensure repo is on main
  try {
    execSync("git checkout main", { cwd: repoPath, stdio: "ignore" });
  } catch {}

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

  // Push to remote. If remote has new commits, rebase with theirs strategy (giving current exported data priority) and retry push.
  try {
    execSync("git push origin main", { cwd: repoPath, stdio: "pipe" });
  } catch (pushErr) {
    log(`[Deploy] Direct push failed, syncing with remote: ${pushErr.message}`);
    try {
      execSync("git pull --rebase -X theirs origin main", { cwd: repoPath, stdio: "pipe" });
      execSync("git push origin main", { cwd: repoPath, stdio: "pipe" });
    } catch (rebaseErr) {
      // CRITICAL: Always abort rebase so repo is never left in detached HEAD!
      try {
        execSync("git rebase --abort", { cwd: repoPath, stdio: "ignore" });
      } catch {}
      throw new Error(`Git deploy push failed: ${rebaseErr.message}`);
    }
  }

  log("[Deploy] Daily batch pushed; Vercel redeploy started");
  return { pushed: true };
}