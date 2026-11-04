import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const bridgeSrc = readFileSync(new URL("../../server/firebaseIdentity.mjs", import.meta.url), "utf8");
const serverSrc = readFileSync(new URL("../../server/accounts.mjs", import.meta.url), "utf8");

test("server identity bridge strictly verifies Firebase tokens without bypasses", () => {
  assert.doesNotMatch(bridgeSrc, /12345678-0000-0000-0000-000123456789/, "Hardcoded fake UID must be removed");
  assert.doesNotMatch(bridgeSrc, /token === '123456'/, "Hardcoded OTP token check must be removed");
  assert.doesNotMatch(serverSrc, /dummyPassword/, "dummyPassword auto-creation must be removed");
  assert.doesNotMatch(serverSrc, /Alex Sharma.*Chef Rajesh/, "Hardcoded sample accounts seeding must be removed in production");
});
