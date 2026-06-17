import path from "node:path";
import { deployWebsiteFile } from "./siteDeploy.js";
import { log } from "./utils.js";

/**
 * Push exported posts.json to the website repo when auto-deploy is enabled.
 * @param {Object} config
 */
export function deployPostsJsonIfNeeded(config) {
  if (!config.websiteAutoDeploy || !config.websitePath) {
    return { pushed: false };
  }

  const postsJsonPath = path.resolve(config.websitePath, "public/data/posts.json");
  try {
    return deployWebsiteFile(config, postsJsonPath);
  } catch (error) {
    log(`[Deploy] Failed to push posts.json: ${error.message}`);
    return { pushed: false };
  }
}