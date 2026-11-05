import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";

const functionsSrc = readFileSync(new URL("../../functions/index.js", import.meta.url), "utf8");
const firebaseHelperSrc = readFileSync(new URL("../../src/data/firebaseHelper.ts", import.meta.url), "utf8");
const serverAccountsSrc = readFileSync(new URL("../../server/accounts.mjs", import.meta.url), "utf8");

test("system strictly excludes demo bypasses, mock accounts, and sample seeds", () => {
  assert.doesNotMatch(functionsSrc, /isDemo/, "functions/index.js must not contain isDemo bypasses");
  assert.doesNotMatch(functionsSrc, /demo-customer/, "functions/index.js must not contain demo-customer bypasses");
  assert.doesNotMatch(functionsSrc, /demo-driver/, "functions/index.js must not contain demo-driver bypasses");
  assert.doesNotMatch(functionsSrc, /demo-merchant/, "functions/index.js must not contain demo-merchant bypasses");
  assert.doesNotMatch(firebaseHelperSrc, /isDemo/, "firebaseHelper.ts must not contain isDemo bypasses");
  assert.doesNotMatch(firebaseHelperSrc, /demo-/, "firebaseHelper.ts must not contain demo- bypasses");
  assert.doesNotMatch(serverAccountsSrc, /\/api\/auth\/service-identity/, "service-identity bridge route must be removed from server/accounts.mjs");
  assert.equal(existsSync(new URL("../../server/seedSampleAccounts.mjs", import.meta.url)), false, "seedSampleAccounts.mjs must be deleted");
  assert.equal(existsSync(new URL("../../scripts/seed-usb-login.mjs", import.meta.url)), false, "seed-usb-login.mjs must be deleted");
});
