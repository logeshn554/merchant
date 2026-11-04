const SELLER_VERTICALS = Object.freeze(['restaurant', 'home_kitchen', 'grocery', 'handmade']);
const CATALOG_ITEM_TYPES = Object.freeze(['prepared_food', 'homemade_food', 'grocery_product', 'handmade_product']);
const FULFILLMENT_METHODS = Object.freeze(['platform_delivery', 'seller_delivery', 'third_party_shipping', 'customer_pickup', 'scheduled_delivery', 'scheduled_pickup']);
const CATALOG_ITEM_TYPE_BY_VERTICAL = Object.freeze({
  restaurant: 'prepared_food',
  home_kitchen: 'homemade_food',
  grocery: 'grocery_product',
  handmade: 'handmade_product',
});

function isSellerVertical(value) {
  return typeof value === 'string' && SELLER_VERTICALS.includes(value);
}

function isCatalogItemType(value) {
  return typeof value === 'string' && CATALOG_ITEM_TYPES.includes(value);
}

function catalogItemTypeForVertical(vertical) {
  if (!isSellerVertical(vertical)) throw new Error('Choose a supported seller vertical.');
  return CATALOG_ITEM_TYPE_BY_VERTICAL[vertical];
}

function isFulfillmentMethod(value) {
  return typeof value === 'string' && FULFILLMENT_METHODS.includes(value);
}

function assertBoundedString(value, field, max, required = false) {
  if (typeof value !== 'string' || value.length > max || required && !value.trim()) throw new Error(`Enter a valid ${field}.`);
  return value.trim();
}

function handmadeCatalogItem(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid handmade catalog item.');
  const priceCents = input.priceCents;
  if (!Number.isSafeInteger(priceCents) || priceCents <= 0 || priceCents > 10000000) throw new Error('Enter a valid handmade price in cents.');
  const result = {
    itemType: 'handmade_product',
    name: assertBoundedString(input.name, 'product name', 120, true),
    description: assertBoundedString(input.description ?? '', 'description', 2000),
    category: assertBoundedString(input.category, 'craft category', 80, true),
    priceCents,
    images: Array.isArray(input.images) ? input.images.filter(image => typeof image === 'string' && image.startsWith('https://')).slice(0, 12) : [],
    availableStock: input.availableStock,
    madeToOrder: input.madeToOrder === true,
    productionLeadTimeHours: input.productionLeadTimeHours,
    material: assertBoundedString(input.material ?? '', 'material', 200),
    technique: assertBoundedString(input.technique ?? '', 'craft technique', 200),
    customization: assertBoundedString(input.customization ?? '', 'customization details', 1000),
    packaging: assertBoundedString(input.packaging ?? '', 'packaging information', 1000),
    fragile: input.fragile === true,
  };
  if (!Number.isSafeInteger(result.availableStock) || result.availableStock < 0 || result.availableStock > 1000000) throw new Error('Enter a valid handmade stock count.');
  if (!Number.isSafeInteger(result.productionLeadTimeHours) || result.productionLeadTimeHours < 0 || result.productionLeadTimeHours > 8760) throw new Error('Enter a valid production lead time.');
  if (result.madeToOrder && result.productionLeadTimeHours < 1) throw new Error('Made-to-order products need a production lead time.');
  return result;
}

function homemadeFoodCatalogItem(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid homemade-food catalog item.');
  const result = {
    itemType: 'homemade_food',
    name: assertBoundedString(input.name, 'product name', 120, true),
    description: assertBoundedString(input.description ?? '', 'description', 2000),
    category: assertBoundedString(input.category, 'category', 80, true),
    ingredients: assertBoundedString(input.ingredients ?? '', 'ingredients', 2000),
    allergens: Array.isArray(input.allergens) ? [...new Set(input.allergens.map(value => assertBoundedString(value, 'allergen', 80, true)))] : [],
    priceCents: input.priceCents,
    batchQuantity: input.batchQuantity,
    productionCapacity: input.productionCapacity,
    preparationLeadTimeMinutes: input.preparationLeadTimeMinutes,
    orderCutoffMinutes: input.orderCutoffMinutes,
    preOrder: input.preOrder === true,
  };
  if (!Number.isSafeInteger(result.priceCents) || result.priceCents <= 0) throw new Error('Enter a valid homemade-food price in cents.');
  for (const [field, value] of [['batch quantity', result.batchQuantity], ['production capacity', result.productionCapacity]]) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 1000000) throw new Error(`Enter a valid ${field}.`);
  }
  for (const [field, value] of [['preparation lead time', result.preparationLeadTimeMinutes], ['order cutoff', result.orderCutoffMinutes]]) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 10080) throw new Error(`Enter a valid ${field}.`);
  }
  return result;
}

module.exports = {
  SELLER_VERTICALS,
  CATALOG_ITEM_TYPES,
  FULFILLMENT_METHODS,
  catalogItemTypeForVertical,
  handmadeCatalogItem,
  homemadeFoodCatalogItem,
  isCatalogItemType,
  isFulfillmentMethod,
  isSellerVertical,
};
