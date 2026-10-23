import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { setConfigStorePathForTests, readStoredConfig, saveStoredConfig } from "./config.js";

describe("server configuration storage", () => {
  it("loads saved values from disk and preserves explicit env fallbacks", () => {
    const dir = mkdtempSync(join(tmpdir(), "waternodes-config-"));
    try {
      const storePath = join(dir, "config.json");
      writeFileSync(storePath, JSON.stringify({ supportRoleId: "role-123", ticketCategoryId: "category-456" }, null, 2));
      setConfigStorePathForTests(storePath);

      const config = readStoredConfig();
      assert.equal(config.supportRoleId, "role-123");
      assert.equal(config.ticketCategoryId, "category-456");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("saves new values into the config file", () => {
    const dir = mkdtempSync(join(tmpdir(), "waternodes-config-"));
    try {
      const storePath = join(dir, "config.json");
      setConfigStorePathForTests(storePath);

      saveStoredConfig({ supportRoleId: "role-999", ticketCategoryId: "category-321", closedTicketCategoryId: "archive-111" });

      const stored = readStoredConfig();
      assert.equal(stored.supportRoleId, "role-999");
      assert.equal(stored.ticketCategoryId, "category-321");
      assert.equal(stored.closedTicketCategoryId, "archive-111");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
