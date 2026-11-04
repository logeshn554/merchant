import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const accountsSrc = readFileSync(new URL("../../src/accounts.ts", import.meta.url), "utf8");
const phoneFlowSrc = readFileSync(new URL("../../src/components/PhoneAccountFlow.tsx", import.meta.url), "utf8");
const authScreenSrc = readFileSync(new URL("../../src/components/AuthScreen.tsx", import.meta.url), "utf8");

test("authentication codebase strictly excludes demo fallbacks and synthetic tokens", () => {
  assert.doesNotMatch(accountsSrc, /signInDemoAccount/, "signInDemoAccount must be deleted from accounts.ts");
  assert.doesNotMatch(accountsSrc, /test-token-/, "Synthetic test tokens must be deleted from accounts.ts");
  assert.doesNotMatch(accountsSrc, /'a'\.repeat\(64\)/, "Fake 64-character session tokens must be deleted from accounts.ts");
  assert.doesNotMatch(phoneFlowSrc, /isTestPhone/, "isTestPhone detection must be removed from PhoneAccountFlow.tsx");
  assert.doesNotMatch(phoneFlowSrc, /1234567890/, "Hardcoded demo phone numbers must be removed from PhoneAccountFlow.tsx");
  assert.doesNotMatch(phoneFlowSrc, /123456/, "Hardcoded OTP 123456 must be removed from PhoneAccountFlow.tsx");
  assert.doesNotMatch(authScreenSrc, /1234567890/, "Demo phone guidance must be removed from AuthScreen.tsx");
  assert.doesNotMatch(authScreenSrc, /OTP 123456/, "Demo OTP guidance must be removed from AuthScreen.tsx");
});
