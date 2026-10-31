import type { Booking } from '../types';

export function canEditMerchantPreparation(booking: Pick<Booking, 'status' | 'paymentStatus' | 'driverId'>): boolean {
  return (booking.status === 'pending' || booking.status === 'preparing') && (booking.paymentStatus === 'paid' || booking.paymentStatus === 'pending_cod') && !booking.driverId;
}
