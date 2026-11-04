import type { UserProfile } from '../types';
import { isLegacyMerchantType } from '../domain/merchant';
export type AppAudience = 'customer' | 'merchant' | 'driver';

export function workspaceFor(
  audience: AppAudience,
  profile: Pick<UserProfile, 'role' | 'merchantId' | 'merchantType' | 'merchantBusinessIds' | 'merchantStaffAccess' | 'transportOperatorId'>
) {
  if (audience === 'customer') return profile.role === 'admin' ? 'admin' : 'customer';

  if (audience === 'driver') {
    if (profile.role === 'driver') return 'driver';
    if (profile.role === 'customer') return 'application';
    return 'denied';
  }

  if (audience === 'merchant') {
    const hasAssignedOutlets = Boolean(
      profile.transportOperatorId?.trim() ||
      (profile.merchantId?.trim() && isLegacyMerchantType(profile.merchantType)) ||
      (profile.merchantBusinessIds?.restaurant && profile.merchantBusinessIds.restaurant.length > 0) ||
      (profile.merchantBusinessIds?.grocery && profile.merchantBusinessIds.grocery.length > 0) ||
      (profile.merchantStaffAccess && Object.keys(profile.merchantStaffAccess).length > 0)
    );
    if (hasAssignedOutlets) return 'merchant';
    if (profile.role === 'merchant') return 'unassigned';
    if (profile.role === 'customer') return 'application';
    return 'denied';
  }

  return 'denied';
}
