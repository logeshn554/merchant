const test = require('node:test');
const assert = require('node:assert/strict');
const { catalogEnvelope } = require('./catalogEnvelope');

const base = {
  id: 'item_1', businessId: 'business_1', sellerVertical: 'handmade', itemType: 'handmade_product',
  name: 'Woven basket', description: 'Hand-finished', category: 'Decor', priceCents: 120000,
  images: ['https://cdn.example.test/basket.jpg'], publicationStatus: 'published', availabilityStatus: 'available', revision: 1,
};

test('catalog envelope binds seller vertical to item type and preserves common fields', () => {
  assert.deepEqual(catalogEnvelope(base), base);
  assert.throws(() => catalogEnvelope({ ...base, itemType: 'grocery_product' }), /does not match/);
  assert.throws(() => catalogEnvelope({ ...base, sellerVertical: 'parcel' }), /supported seller vertical/);
});

test('catalog envelope rejects unsafe publication, price, identity and image data', () => {
  assert.throws(() => catalogEnvelope({ ...base, priceCents: 1.5 }));
  assert.throws(() => catalogEnvelope({ ...base, images: ['http://unsafe.test/image.jpg'] }));
  assert.throws(() => catalogEnvelope({ ...base, publicationStatus: 'live' }));
  assert.throws(() => catalogEnvelope({ ...base, businessId: '../other' }));
});