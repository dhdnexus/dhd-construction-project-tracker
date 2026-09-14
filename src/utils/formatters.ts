/**
 * Currency & numerical formatters for Nigerian Naira (₦)
 * Tabular, accurate, rounded cleanly without floating-point quirks.
 */

export function formatNaira(amount: number | null | undefined, showDecimals: boolean = false): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₦0';
  }
  const rounded = showDecimals ? Number(amount.toFixed(2)) : Math.round(amount);
  const formatted = rounded.toLocaleString('en-US', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });
  return `₦${formatted}`;
}

export function formatNairaCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    const val = amount / 1_000_000;
    return `₦${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    const val = amount / 1_000;
    return `₦${val % 1 === 0 ? val.toFixed(0) : val.toFixed(0)}K`;
  }
  return formatNaira(amount);
}

export function parseNairaInput(val: string | number): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const clean = val.replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatNumber(num: number): string {
  if (isNaN(num) || num === null || num === undefined) return '0';
  return Math.round(num).toLocaleString('en-US');
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatRelativeTime(dateString: string): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(dateString);
  } catch {
    return dateString;
  }
}

/**
 * Validates the critical calculation test:
 * Quantity: 10
 * Unit Price: 15,000 -> Material Cost: 150,000
 * Haulage: 20,000
 * Offloading: 5,000
 * Acquisition Cost: 175,000
 * Amount Paid: 100,000
 * Outstanding: 75,000
 */
export function calculatePurchaseTotals(
  quantity: number,
  unitPrice: number,
  haulage: number = 0,
  offloading: number = 0,
  other: number = 0,
  amountPaid: number = 0
) {
  const safeQty = Math.max(0, quantity);
  const safePrice = Math.max(0, unitPrice);
  const safeHaulage = Math.max(0, haulage);
  const safeOffload = Math.max(0, offloading);
  const safeOther = Math.max(0, other);
  const safePaid = Math.max(0, amountPaid);

  const materialCost = Math.round(safeQty * safePrice);
  const acquisitionCost = materialCost + safeHaulage + safeOffload + safeOther;
  const supplierBalance = Math.max(0, acquisitionCost - safePaid);

  return {
    materialCost,
    acquisitionCost,
    supplierBalance,
  };
}
