import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const portalSrc = readFileSync(new URL("../../src/components/MerchantPortal.tsx", import.meta.url), "utf8");

test("merchant portal accepts all seller verticals in props and outlet selector", () => {
  assert.match(portalSrc, /merchantType\?:\s*SellerVertical/);
  assert.match(portalSrc, /Home kitchen operations|Handmade operations/);
});
