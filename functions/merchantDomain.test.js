const test = require('node:test');
const assert = require('node:assert/strict');
const {
  catalogItemTypeForVertical,
  handmadeCatalogItem,
  homemadeFoodCatalogItem,
  isFulfillmentMethod,
  isSellerVertical,
} = require('./merchantDomain');

test('seller verticals map to distinct catalog item types', () => {
  assert.equal(catalogItemTypeForVertical('restaurant'), 'prepared_food');
  assert.equal(catalogItemTypeForVertical('home_kitchen'), 'homemade_food');
  assert.equal(catalogItemTypeForVertical('grocery'), 'grocery_product');
  assert.equal(catalogItemTypeForVertical('handmade'), 'handmade_product');
  assert.equal(isSellerVertical('handmade'), true);
  assert.equal(isSellerVertical('parcel'), false);
});

test('handmade catalog validation keeps physical-product fields separate from food fields', () => {
  const item = handmadeCatalogItem({
    name: 'Woven basket',
    description: 'Hand-finished palm basket',
    category: 'Home decor',
    priceCents: 125000,
    images: ['https://cdn.example.test/basket.jpg'],
    availableStock: 4,
    madeToOrder: true,
    productionLeadTimeHours: 48,
    material: 'Palm leaf',
    technique: 'Coiling',
    customization: 'Optional initials',
    packaging: 'Recycled protective wrap',
    fragile: false,
  });
  assert.equal(item.itemType, 'handmade_product');
  assert.equal(item.productionLeadTimeHours, 48);
  assert.equal('ingredients' in item, false);
  assert.throws(() => handmadeCatalogItem({ ...item, madeToOrder: true, productionLeadTimeHours: 0 }));
  assert.throws(() => handmadeCatalogItem({ ...item, availableStock: -1 }));
});

test('home-kitchen validation models batch capacity and scheduled production', () => {
  const item = homemadeFoodCatalogItem({
    name: 'Coconut ladoo',
    description: 'Fresh small-batch sweets',
    category: 'Sweets',
    ingredients: 'Coconut, sugar, cardamom',
    allergens: ['Coconut'],
    priceCents: 45000,
    batchQuantity: 20,
    productionCapacity: 60,
    preparationLeadTimeMinutes: 180,
    orderCutoffMinutes: 120,
    preOrder: true,
  });
  assert.equal(item.itemType, 'homemade_food');
  assert.equal(item.preOrder, true);
  assert.throws(() => homemadeFoodCatalogItem({ ...item, productionCapacity: 0 }));
  assert.throws(() => homemadeFoodCatalogItem({ ...item, allergens: [''] }));
});

test('fulfillment methods are explicit and parcel is not a seller vertical', () => {
  assert.equal(isFulfillmentMethod('third_party_shipping'), true);
  assert.equal(isFulfillmentMethod('parcel'), false);
});
