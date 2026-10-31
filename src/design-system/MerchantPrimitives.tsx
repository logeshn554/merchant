import type { ReactNode } from 'react';

export type MerchantStatus = 'new' | 'preparing' | 'ready' | 'picked-up' | 'cancelled' | 'neutral';

export function MerchantCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`merchant-card ${className}`.trim()}>{children}</section>;
}

export function MerchantBadge({ status = 'neutral', children }: { status?: MerchantStatus; children: ReactNode }) {
  return <span className={`merchant-badge merchant-badge-${status}`}>{children}</span>;
}

export function MerchantSwitch({ checked, label, onChange, disabled = false }: { checked: boolean; label: string; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`merchant-switch ${disabled ? 'is-disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
      <span className="merchant-switch-track" aria-hidden="true"><span /></span>
      <span>{label}</span>
    </label>
  );
}

export function MerchantTabs<T extends string>({ items, value, onChange, label }: { items: readonly { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div className="merchant-tabs" role="tablist" aria-label={label}>
      {items.map(item => (
        <button key={item.id} type="button" role="tab" aria-selected={value === item.id} onClick={() => onChange(item.id)}>
          <span>{item.label}</span>
          {item.count !== undefined && <span className="merchant-tab-count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function MerchantCountdown({ seconds, label = 'Time remaining' }: { seconds: number; label?: string }) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = String(safeSeconds % 60).padStart(2, '0');
  return <span className="merchant-countdown" aria-label={`${label}: ${minutes}:${remainder}`}>{minutes}:{remainder}</span>;
}

export function MerchantStatCard({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon?: ReactNode }) {
  return <article className="merchant-stat-card"><div className="merchant-stat-card-heading"><span>{label}</span>{icon}</div><strong>{value}</strong>{detail && <small>{detail}</small>}</article>;
}
