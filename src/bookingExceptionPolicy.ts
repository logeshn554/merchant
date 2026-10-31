export const bookingExceptionKinds = (serviceType: string, status: string, isCod?: boolean) => {
  const kinds = ['delay', 'damage', 'lost', 'safety', 'vehicle_breakdown', 'address_inaccessible'];
  if (['accepted', 'preparing', 'ready'].includes(status)) kinds.push('failed_pickup');
  if (['accepted', 'preparing'].includes(status) && ['food', 'grocery'].includes(serviceType)) kinds.push('merchant_not_ready');
  if (status === 'transit' || status === 'arrived_at_destination') {
    kinds.push('failed_delivery', 'customer_unavailable', 'customer_refusal');
  }
  if (isCod) kinds.push('cash_discrepancy');
  if (['food', 'grocery'].includes(serviceType)) kinds.push('merchant_unavailable');
  return kinds;
};
