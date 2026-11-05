import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";

const accountsSrc = readFileSync(new URL("../../src/accounts.ts", import.meta.url), "utf8");
const appSrc = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const authScreenSrc = readFileSync(new URL("../../src/components/AuthScreen.tsx", import.meta.url), "utf8");

test("frontend exclusively uses Firebase Authentication for identity and sessions", () => {
  assert.match(accountsSrc, /onAuthStateChanged/, "accounts.ts must observe Firebase Auth state");
  assert.doesNotMatch(accountsSrc, /useNeonAccounts/, "useNeonAccounts must be completely deleted from accounts.ts");
  assert.doesNotMatch(accountsSrc, /signInAccount/, "signInAccount must be deleted from accounts.ts");
  assert.doesNotMatch(accountsSrc, /connectServiceIdentity/, "connectServiceIdentity bridge must be deleted from accounts.ts");
  assert.doesNotMatch(appSrc, /useNeonAccounts/, "App.tsx must not reference useNeonAccounts");
  assert.doesNotMatch(appSrc, /watchAccount/, "App.tsx must use Firebase Auth listener directly");
  assert.doesNotMatch(authScreenSrc, /useNeonAccounts/, "AuthScreen.tsx must not reference useNeonAccounts");
  assert.equal(existsSync(new URL("../../src/data/neonAccounts.ts", import.meta.url)), false, "neonAccounts.ts must be completely removed");
});
