export const SELLER_VERTICALS = ['restaurant', 'home_kitchen', 'grocery', 'handmade'] as const;
export type SellerVertical = typeof SELLER_VERTICALS[number];

export const CATALOG_ITEM_TYPES = ['prepared_food', 'homemade_food', 'grocery_product', 'handmade_product'] as const;
export type CatalogItemType = typeof CATALOG_ITEM_TYPES[number];

export const FULFILLMENT_METHODS = ['platform_delivery', 'seller_delivery', 'third_party_shipping', 'customer_pickup', 'scheduled_delivery', 'scheduled_pickup'] as const;
export type FulfillmentMethod = typeof FULFILLMENT_METHODS[number];

export const ORDER_TYPES = ['prepared_food', 'grocery', 'made_to_order', 'physical_product'] as const;
export type OrderType = typeof ORDER_TYPES[number];

export const DELIVERY_PROVIDERS = ['allgo', 'seller', 'third_party', 'none'] as const;
export type DeliveryProvider = typeof DELIVERY_PROVIDERS[number];

export type LegacyMerchantType = Extract<SellerVertical, 'restaurant' | 'grocery'>;

export const catalogItemTypeForVertical: Record<SellerVertical, CatalogItemType> = {
  restaurant: 'prepared_food',
  home_kitchen: 'homemade_food',
  grocery: 'grocery_product',
  handmade: 'handmade_product',
};

export function isSellerVertical(value: unknown): value is SellerVertical {
  return typeof value === 'string' && (SELLER_VERTICALS as readonly string[]).includes(value);
}

export function isLegacyMerchantType(value: unknown): value is LegacyMerchantType {
  return value === 'restaurant' || value === 'grocery';
}

export function isFulfillmentMethod(value: unknown): value is FulfillmentMethod {
  return typeof value === 'string' && (FULFILLMENT_METHODS as readonly string[]).includes(value);
}
