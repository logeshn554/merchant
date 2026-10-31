export type ProgressStatus =
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

export function getBookingProgress(status: ProgressStatus): number {
  return ({
    pending: 15,
    driver_offer_pending: 25,
    accepted: 35,
    preparing: 55,
    ready: 65,
    driver_assigned: 70,
    driver_at_store: 75,
    pickup_verified: 80,
    transit: 82,
    arrived_at_destination: 92,
    delivery_otp_verified: 98,
    delivered: 100, completed: 100,
    cancelled: 0,
  })[status] ?? 0;
}
