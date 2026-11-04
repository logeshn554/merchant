import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const panelSrc = readFileSync(new URL("../../src/components/PartnerApplicationPanel.tsx", import.meta.url), "utf8");
const setupSrc = readFileSync(new URL("../../src/components/MerchantBusinessSetup.tsx", import.meta.url), "utf8");

test("partner onboarding UI supports all seller verticals including home kitchen and handmade", () => {
  assert.match(panelSrc, /home_kitchen/);
  assert.match(panelSrc, /handmade/);
  assert.match(setupSrc, /home_kitchen/);
  assert.match(setupSrc, /handmade/);
});
