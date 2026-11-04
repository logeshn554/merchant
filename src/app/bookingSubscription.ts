import type { Booking, UserProfile } from '../types';
import type { MerchantBookingOutlet } from '../data/firebaseHelper';
import { subscriptionGroup } from '../data/subscriptionGroup';
import { workspaceFor } from './workspace';
import { isLegacyMerchantType } from '../domain/merchant';

type Stop = () => void;
type Receive = (bookings: Booking[]) => void;
type Failure = (error: unknown) => void;
interface BookingListeners {
  listenToBookings: (receive: Receive, onError: Failure) => Stop;
  listenToCustomerBookings: (uid: string, receive: Receive, onError: Failure) => Stop;
  listenToDriverBookings: (uid: string, receive: Receive, onError: Failure) => Stop;
  listenToMerchantBookings: (outlets: MerchantBookingOutlet[], receive: Receive, onError: Failure) => Stop;
}

// Choose the data scope of the rendered workspace. Authorization remains server-side.
export function subscribeWorkspaceBookings(
  audience: 'customer' | 'merchant' | 'driver',
  uid: string,
  profile: Pick<UserProfile, 'role' | 'merchantId' | 'merchantType' | 'merchantBusinessIds' | 'merchantStaffAccess' | 'transportOperatorId'>,
  listeners: BookingListeners,
  receive: Receive,
  onError: Failure = console.error,
): Stop {
  const group = subscriptionGroup<Booking[]>(receive, () => [], onError);
  const publish = group.publish;
  receive([]);
  try {
    const workspace = workspaceFor(audience, profile);
    const primaryMerchantType = isLegacyMerchantType(profile.merchantType) ? profile.merchantType : undefined;
    const merchantOutlets: MerchantBookingOutlet[] = [
      ...(profile.merchantId && primaryMerchantType ? [{ merchantId: profile.merchantId, merchantType: primaryMerchantType }] : []),
      ...(profile.merchantBusinessIds?.restaurant || []).map(merchantId => ({ merchantId, merchantType: 'restaurant' as const })),
      ...(profile.merchantBusinessIds?.grocery || []).map(merchantId => ({ merchantId, merchantType: 'grocery' as const })),
      ...Object.entries(profile.merchantStaffAccess || {}).flatMap(([merchantId, grant]) => isLegacyMerchantType(grant?.merchantType) && Array.isArray(grant.permissions) && grant.permissions.includes('orders') ? [{ merchantId, merchantType: grant.merchantType }] : []),
    ];
    const stop = workspace === 'admin'
      ? listeners.listenToBookings(publish, group.fail)
      : workspace === 'customer'
        ? listeners.listenToCustomerBookings(uid, publish, group.fail)
        : workspace === 'driver'
          ? listeners.listenToDriverBookings(uid, publish, group.fail)
          : workspace === 'merchant' && profile.transportOperatorId
            ? () => undefined
          : workspace === 'merchant' && merchantOutlets.length > 0
            ? listeners.listenToMerchantBookings(merchantOutlets, publish, group.fail)
            : () => undefined;
    group.add(stop);
  } catch (error) { group.fail(error); }
  return group.stop;
}
