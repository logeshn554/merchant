import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type MerchantButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type MerchantButtonSize = 'md' | 'lg';

export interface MerchantButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: MerchantButtonVariant;
  size?: MerchantButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export function MerchantButton({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  className = '',
  ...props
}: MerchantButtonProps) {
  return (
    <button
      {...props}
      type={props.type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`merchant-button merchant-button-${variant} merchant-button-${size} ${className}`.trim()}
    >
      {loading && <span className="merchant-button-spinner" aria-hidden="true" />}
      {!loading && icon}
      <span>{loading ? 'Working…' : children}</span>
    </button>
  );
}

export interface MerchantIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function MerchantIconButton({ label, className = '', ...props }: MerchantIconButtonProps) {
  return (
    <button {...props} type={props.type ?? 'button'} aria-label={label} title={props.title ?? label} className={`merchant-icon-button ${className}`.trim()}>
      {props.children}
    </button>
  );
}
