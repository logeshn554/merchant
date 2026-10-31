import React from 'react';
import { MapPin, ShoppingCart, Bell, User } from 'lucide-react';
import type { SavedAddress } from '../../types';

interface CustomerHeaderProps {
  deliveryAddress: string;
  detectedAddress?: string;
  savedAddresses: SavedAddress[];
  cartItemCount: number;
  cartService?: string | null;
  hasActiveNotifications: boolean;
  paymentBusy?: boolean;
  onOpenAddressModal: () => void;
  onOpenCart: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  children?: React.ReactNode;
  'aria-label'?: string;
}

export const CustomerHeader: React.FC<CustomerHeaderProps> = ({
  deliveryAddress,
  detectedAddress,
  savedAddresses,
  cartItemCount,
  cartService,
  hasActiveNotifications,
  paymentBusy = false,
  onOpenAddressModal,
  onOpenCart,
  onOpenNotifications,
  onOpenProfile,
  children,
}) => {
  const selectedLabel = savedAddresses.find(a => a.address === deliveryAddress)?.label || 'Delivery address';
  const displayAddress = deliveryAddress || detectedAddress || 'Choose delivery address';

  return (
    <header className="allgo-customer-header safe-area-top sticky top-0 z-10 shrink-0 border-b border-slate-100 bg-white px-4 py-3" data-testid="customer-header">
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={paymentBusy}
          aria-label={`Choose delivery address. Current address: ${displayAddress}`}
          className="flex min-w-0 max-w-[72%] flex-1 items-center gap-2 text-left"
          onClick={onOpenAddressModal}
        >
          <div className="bg-slate-100 p-2.5 rounded-xl text-slate-800">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="food-address-summary">
            <div className="flex items-center gap-0.5">
              <span className="text-sm font-black text-slate-900">{selectedLabel}</span>
              <span className="text-[10px] text-slate-400 font-bold">▼</span>
            </div>
            <p className="text-[10px] font-semibold text-slate-500 truncate" title={displayAddress}>
              {displayAddress}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {cartItemCount > 0 && (
            <button
              type="button"
              disabled={paymentBusy}
              aria-label={`Open ${cartService || ''} cart, ${cartItemCount} items`}
              className="rounded-xl border p-2 text-indigo-700 hover:bg-indigo-50 transition-colors"
              onClick={onOpenCart}
            >
              <ShoppingCart size={20} aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            disabled={paymentBusy}
            aria-label="View notifications"
            onClick={onOpenNotifications}
            className="relative p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {hasActiveNotifications && (
              <span className="absolute top-1.5 right-1.5 bg-rose-500 w-2 h-2 rounded-full border border-white" />
            )}
          </button>

          <button
            type="button"
            disabled={paymentBusy}
            aria-label="Open profile"
            onClick={onOpenProfile}
            className="bg-slate-100 p-2 rounded-xl border border-slate-200 hover:bg-slate-200 transition-colors"
          >
            <User className="w-4 h-4 text-slate-700" />
          </button>
        </div>
      </div>
      {children}
    </header>
  );
};

export default CustomerHeader;
