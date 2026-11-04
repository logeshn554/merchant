import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const assetsDir = path.resolve('dist', 'assets');
const entry = (await readdir(assetsDir)).find(name => /^App-[^/]+\.js$/.test(name));
assert.ok(entry, 'The Vite build did not emit an App entry chunk.');

const source = await readFile(path.join(assetsDir, entry), 'utf8');
assert.match(source, /MerchantPortal-[^/]+\.js/, 'The merchant build must include the MerchantPortal lazy import.');
assert.doesNotMatch(source, /CustomerApp-[^/]+\.js/, 'The merchant build must not select the CustomerApp lazy import.');
assert.match(source, /merchant-splash/, 'The merchant build must contain the merchant splash marker.');

console.log(`Merchant audience verified in dist/assets/${entry}`);
