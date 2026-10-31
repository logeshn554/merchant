import type { ReactNode } from 'react';
import { AlertCircle, Inbox, LoaderCircle, WifiOff } from 'lucide-react';
import { MerchantButton } from './MerchantButton';

export function MerchantSkeleton({ lines = 3 }: { lines?: number }) {
  return <div className="merchant-skeleton" aria-label="Loading" role="status">{Array.from({ length: lines }, (_, index) => <span key={index} />)}</div>;
}

export function MerchantEmptyState({ title, message, action, icon = <Inbox aria-hidden="true" /> }: { title: string; message: string; action?: ReactNode; icon?: ReactNode }) {
  return <div className="merchant-state merchant-state-empty"><div className="merchant-state-icon">{icon}</div><h2>{title}</h2><p>{message}</p>{action}</div>;
}

export function MerchantErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="merchant-state merchant-state-error" role="alert"><div className="merchant-state-icon"><AlertCircle aria-hidden="true" /></div><h2>We could not load this</h2><p>{message}</p><MerchantButton variant="secondary" onClick={onRetry}>Try again</MerchantButton></div>;
}

export function MerchantLoadingState() {
  return <div className="merchant-state merchant-state-loading"><LoaderCircle className="merchant-state-spinner" aria-hidden="true" /><span>Loading your workspace…</span></div>;
}

export function MerchantOfflineBanner() {
  return <div className="merchant-offline-banner" role="status"><WifiOff aria-hidden="true" /><span>You are offline. Safe changes will sync when connection returns.</span></div>;
}

export function MerchantLiveRegion({ children }: { children: ReactNode }) {
  return <div className="merchant-live-region" aria-live="assertive" aria-atomic="true">{children}</div>;
}
