export type ParcelBookingStatus =
  | 'pending'
  | 'driver_offer_pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'driver_assigned'
  | 'driver_at_store'
  | 'pickup_verified'
  | 'transit'
  | 'arrived_at_destination'
  | 'delivery_otp_verified'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export interface ParcelTrackingPresentation {
  stage: number;
  title: string;
  steps: readonly [string, string, string, string];
  terminal: boolean;
}

export function getParcelTrackingPresentation(status: ParcelBookingStatus): ParcelTrackingPresentation {
  const steps = ['Shipment created', 'Partner assigned', 'In transit', 'Delivered'] as const;
  if (status === 'cancelled') return { stage: 0, title: 'Shipment cancelled', steps, terminal: true };
  if (status === 'delivered' || status === 'completed' || status === 'delivery_otp_verified') return { stage: 3, title: 'Shipment delivered', steps, terminal: true };
  if (status === 'transit' || status === 'pickup_verified') return { stage: 2, title: 'Your parcel is in transit', steps, terminal: false };
  if (status === 'arrived_at_destination') return { stage: 2, title: 'Shipment status needs review', steps, terminal: false };
  if (status === 'accepted' || status === 'preparing' || status === 'ready' || status === 'driver_assigned' || status === 'driver_at_store' || status === 'driver_offer_pending') return { stage: 1, title: 'A delivery partner has accepted', steps, terminal: false };
  return { stage: 0, title: 'Waiting for a delivery partner', steps, terminal: false };
}
