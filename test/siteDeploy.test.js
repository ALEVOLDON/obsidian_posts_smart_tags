import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("daily deploy paths", () => {
  it("documents the batch targets used by deploy_posts", async () => {
    const module = await import("../src/lib/siteDeploy.js");
    assert.equal(typeof module.deployWebsiteBatch, "function");
  });
});