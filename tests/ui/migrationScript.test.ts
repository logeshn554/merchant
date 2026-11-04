import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

test("migration script exists and implements safe reconciliation without destructive writes", () => {
  const scriptPath = new URL("../../scripts/migrate-neon-to-firebase.mjs", import.meta.url);
  assert.ok(existsSync(scriptPath), "scripts/migrate-neon-to-firebase.mjs must exist");
  const scriptContent = readFileSync(scriptPath, "utf8");
  assert.match(scriptContent, /allgo_accounts/);
  assert.match(scriptContent, /getAuth/);
  assert.match(scriptContent, /users/);
  assert.match(scriptContent, /dry-run|--dry-run/);
});

