/**
 * Shared Indian Rupee Currency Formatter
 * Standardizes paise <-> rupees conversions and formatting across merchant/driver/customer views.
 */

export interface FormatMoneyOptions {
  showDecimals?: boolean;
  currencySymbol?: string;
}

/**
 * Format an integer paise value into Indian Rupee display (e.g. 150000 -> ₹1,500 or ₹1,500.00).
 */
export function formatPaise(paise: number, options: FormatMoneyOptions = {}): string {
  const { showDecimals = false, currencySymbol = '₹' } = options;
  const safePaise = Number.isFinite(paise) ? paise : 0;
  const rupees = safePaise / 100;
  return formatRupees(rupees, { showDecimals, currencySymbol });
}

/**
 * Format a rupees number into standard Indian numbering format (e.g. 1500 -> ₹1,500).
 */
export function formatRupees(rupees: number, options: FormatMoneyOptions = {}): string {
  const { showDecimals = false, currencySymbol = '₹' } = options;
  const safeRupees = Number.isFinite(rupees) ? rupees : 0;

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 2,
  }).format(safeRupees);

  return `${currencySymbol}${formatted}`;
}

export function paiseToRupees(paise: number): number {
  return (Number.isFinite(paise) ? paise : 0) / 100;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round((Number.isFinite(rupees) ? rupees : 0) * 100);
}
