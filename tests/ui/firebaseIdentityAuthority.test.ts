import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const accountsSrc = readFileSync(new URL("../../src/accounts.ts", import.meta.url), "utf8");
const appSrc = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");

test("frontend exclusively uses Firebase Authentication for identity and sessions", () => {
  assert.match(accountsSrc, /onAuthStateChanged/, "accounts.ts must observe Firebase Auth state");
  assert.doesNotMatch(accountsSrc, /useNeonAccounts\s*=\s*env\.VITE_AUTH_PROVIDER === 'neon'/, "Neon accounts must not be used as identity authority");
  assert.doesNotMatch(appSrc, /watchAccount/, "App.tsx must use Firebase Auth listener directly");
});
