const { catalogItemTypeForVertical, isSellerVertical } = require('./merchantDomain');

const PUBLICATION_STATUSES = Object.freeze(['draft', 'pending_review', 'published', 'unpublished', 'suspended']);
const AVAILABILITY_STATUSES = Object.freeze(['available', 'unavailable', 'sold_out']);

function boundedText(value, field, max, required = false) {
  if (typeof value !== 'string' || value.length > max || required && !value.trim()) throw new Error(`Enter a valid ${field}.`);
  return value.trim();
}

function catalogEnvelope(input) {
  if (!input || typeof input !== 'object' || !isSellerVertical(input.sellerVertical)) throw new Error('Choose a supported seller vertical.');
  const expectedItemType = catalogItemTypeForVertical(input.sellerVertical);
  if (input.itemType !== expectedItemType) throw new Error('The catalog item type does not match the seller vertical.');
  if (typeof input.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input.id)) throw new Error('Enter a valid catalog item ID.');
  if (typeof input.businessId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input.businessId)) throw new Error('Enter a valid business ID.');
  if (!Number.isSafeInteger(input.priceCents) || input.priceCents <= 0 || input.priceCents > 100000000) throw new Error('Enter a valid catalog price in cents.');
  if (!Array.isArray(input.images) || input.images.length > 12 || input.images.some(image => typeof image !== 'string' || !image.startsWith('https://') || image.length > 2048)) throw new Error('Catalog images must be bounded HTTPS URLs.');
  if (!PUBLICATION_STATUSES.includes(input.publicationStatus) || !AVAILABILITY_STATUSES.includes(input.availabilityStatus)) throw new Error('Choose valid publication and availability statuses.');
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw new Error('Catalog revision must be a non-negative integer.');
  return {
    id: input.id,
    businessId: input.businessId,
    ...(typeof input.outletId === 'string' ? { outletId: boundedText(input.outletId, 'outlet ID', 128, true) } : {}),
    sellerVertical: input.sellerVertical,
    itemType: input.itemType,
    name: boundedText(input.name, 'product name', 120, true),
    description: boundedText(input.description ?? '', 'description', 2000),
    category: boundedText(input.category, 'category', 80, true),
    ...(input.subcategory === undefined ? {} : { subcategory: boundedText(input.subcategory, 'subcategory', 80) }),
    priceCents: input.priceCents,
    images: [...input.images],
    publicationStatus: input.publicationStatus,
    availabilityStatus: input.availabilityStatus,
    ...(input.sku === undefined ? {} : { sku: boundedText(input.sku, 'SKU', 128, true) }),
    revision: input.revision,
  };
}

module.exports = { AVAILABILITY_STATUSES, PUBLICATION_STATUSES, catalogEnvelope };