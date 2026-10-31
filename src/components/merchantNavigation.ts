import { BarChart3, History, LifeBuoy, MoreHorizontal, PackageCheck, Settings, Star, Store, Ticket, Utensils, WalletCards } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type MerchantPanel =
  | 'orders' | 'catalog' | 'insights' | 'settlements' | 'settings' | 'more'
  | 'overview' | 'history' | 'reviews' | 'offers' | 'preview' | 'stock'
  | 'business' | 'support' | 'compliance';

export interface MerchantNavItem {
  id: MerchantPanel;
  label: string;
  icon: LucideIcon;
  permission?: 'orders' | 'catalog' | 'business' | 'settlements';
}

export const MERCHANT_PRIMARY_NAV: readonly MerchantNavItem[] = [
  { id: 'orders', label: 'Orders', icon: PackageCheck, permission: 'orders' },
  { id: 'catalog', label: 'Menu', icon: Utensils, permission: 'catalog' },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'settlements', label: 'Earnings', icon: WalletCards, permission: 'settlements' },
  { id: 'business', label: 'Store', icon: Store },
  { id: 'support', label: 'Help', icon: LifeBuoy },
];

export const MERCHANT_SECONDARY_NAV: readonly MerchantNavItem[] = [
  { id: 'history', label: 'Order history', icon: History, permission: 'orders' },
  { id: 'reviews', label: 'Reviews', icon: Star, permission: 'orders' },
  { id: 'offers', label: 'Offers', icon: Ticket, permission: 'business' },
  { id: 'settings', label: 'Settings', icon: Settings, permission: 'business' },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

export function isMerchantPanelActive(panel: MerchantPanel, id: MerchantPanel): boolean {
  if (id === 'orders') return panel === 'orders' || panel === 'history';
  if (id === 'catalog') return panel === 'catalog' || panel === 'stock' || panel === 'preview' || panel === 'offers';
  if (id === 'insights') return panel === 'insights' || panel === 'overview' || panel === 'reviews';
  if (id === 'business') return ['business', 'settings', 'more', 'compliance'].includes(panel);
  if (id === 'support') return panel === 'support';
  if (id === 'settlements') return panel === 'settlements';
  return panel === id;
}
