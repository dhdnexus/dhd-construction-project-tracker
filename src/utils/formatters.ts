/**
 * Currency & numerical formatters for Nigerian Naira (₦)
 * Tabular, accurate, with safe integer kobo arithmetic (₦1 = 100 kobo).
 */

export function toKobo(naira: number): number {
  if (naira === null || naira === undefined || isNaN(naira) || !isFinite(naira)) return 0;
  return Math.round(naira * 100);
}

export function fromKobo(kobo: number): number {
  if (kobo === null || kobo === undefined || isNaN(kobo) || !isFinite(kobo)) return 0;
  return Math.round(kobo) / 100;
}

export function formatNaira(amount: number | null | undefined, showDecimals: boolean = false): string {
  if (amount === null || amount === undefined || isNaN(amount) || !isFinite(amount)) {
    return '₦0';
  }
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const rounded = showDecimals ? Number(abs.toFixed(2)) : Math.round(abs);
  const formatted = rounded.toLocaleString('en-US', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });
  return `${isNegative ? '-' : ''}₦${formatted}`;
}

export function formatNairaCompact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount) || !isFinite(amount)) {
    return '₦0';
  }
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const sign = isNegative ? '-' : '';

  if (abs >= 1_000_000_000) {
    const val = abs / 1_000_000_000;
    return `${sign}₦${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}B`;
  }
  if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    return `${sign}₦${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}M`;
  }
  if (abs >= 10_000) {
    const val = abs / 1_000;
    return `${sign}₦${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}K`;
  }
  if (abs >= 1_000) {
    const val = abs / 1_000;
    return `${sign}₦${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}K`;
  }
  return `${sign}${formatNaira(abs)}`;
}

export function parseNairaInput(val: string | number | null | undefined): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const clean = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num) || !isFinite(num)) return '0';
  return Math.round(num).toLocaleString('en-US');
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(dateString);
  }
}

export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
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
    return String(dateString);
  }
}

export function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Validates purchase calculations with integer kobo precision:
 * Quantity: 12
 * Unit Price: 16,000 -> Material Cost: 192,000
 * Haulage: 20,000
 * Offloading: 5,000
 * Landed Acquisition Cost: 217,000
 * Amount Paid: 100,000
 * Outstanding: 117,000
 * Overpayment: 0
 */
export function calculatePurchaseTotals(
  quantity: number,
  unitPrice: number,
  haulage: number = 0,
  offloading: number = 0,
  other: number = 0,
  amountPaid: number = 0
) {
  const unitPriceKobo = toKobo(Math.max(0, unitPrice));
  const haulageCostKobo = toKobo(Math.max(0, haulage));
  const offloadingCostKobo = toKobo(Math.max(0, offloading));
  const otherCostKobo = toKobo(Math.max(0, other));
  const amountPaidKobo = toKobo(Math.max(0, amountPaid));

  return calculatePurchaseTotalsFromKobo(
    quantity,
    unitPriceKobo,
    haulageCostKobo,
    offloadingCostKobo,
    otherCostKobo,
    amountPaidKobo
  );
}

export function calculatePurchaseTotalsFromKobo(
  quantity: number,
  unitPriceKobo: number,
  haulageCostKobo: number = 0,
  offloadingCostKobo: number = 0,
  otherCostKobo: number = 0,
  amountPaidKobo: number = 0
) {
  const safeQty = Math.max(0, quantity);
  const safeUnitPriceKobo = Math.max(0, Math.round(unitPriceKobo));
  const safeHaulageKobo = Math.max(0, Math.round(haulageCostKobo));
  const safeOffloadKobo = Math.max(0, Math.round(offloadingCostKobo));
  const safeOtherKobo = Math.max(0, Math.round(otherCostKobo));
  const safePaidKobo = Math.max(0, Math.round(amountPaidKobo));

  const materialCostKobo = Math.round(safeQty * safeUnitPriceKobo);
  const acquisitionCostKobo = safeHaulageKobo + safeOffloadKobo + safeOtherKobo + materialCostKobo;
  const balanceKobo = acquisitionCostKobo - safePaidKobo;

  const supplierBalanceKobo = Math.max(0, balanceKobo);
  const supplierOverpaymentKobo = Math.max(0, -balanceKobo);

  return {
    unitPriceKobo: safeUnitPriceKobo,
    materialCostKobo,
    haulageCostKobo: safeHaulageKobo,
    offloadingCostKobo: safeOffloadKobo,
    otherCostKobo: safeOtherKobo,
    acquisitionCostKobo,
    amountPaidKobo: safePaidKobo,
    supplierBalanceKobo,
    supplierOverpaymentKobo,
    unitPrice: fromKobo(safeUnitPriceKobo),
    materialCost: fromKobo(materialCostKobo),
    haulageCost: fromKobo(safeHaulageKobo),
    offloadingCost: fromKobo(safeOffloadKobo),
    otherCost: fromKobo(safeOtherKobo),
    acquisitionCost: fromKobo(acquisitionCostKobo),
    amountPaid: fromKobo(safePaidKobo),
    supplierBalance: fromKobo(supplierBalanceKobo),
    supplierOverpayment: fromKobo(supplierOverpaymentKobo),
  };
}

/**
 * Calculates contractor payment balances with integer kobo precision:
 * Agreed: 1,000,000
 * Paid: 650,000 -> Outstanding: 350,000, Overpayment: 0
 * Paid: 1,100,000 -> Outstanding: 0, Overpayment: 100,000
 */
export function calculateLabourBalances(agreedAmount: number, totalPaid: number) {
  const agreedAmountKobo = toKobo(Math.max(0, agreedAmount));
  const totalPaidKobo = toKobo(Math.max(0, totalPaid));
  return calculateLabourBalancesFromKobo(agreedAmountKobo, totalPaidKobo);
}

export function calculateLabourBalancesFromKobo(agreedAmountKobo: number, totalPaidKobo: number) {
  const safeAgreedKobo = Math.max(0, Math.round(agreedAmountKobo));
  const safePaidKobo = Math.max(0, Math.round(totalPaidKobo));
  const diffKobo = safeAgreedKobo - safePaidKobo;

  const outstandingBalanceKobo = Math.max(0, diffKobo);
  const overpaymentKobo = Math.max(0, -diffKobo);

  return {
    agreedAmountKobo: safeAgreedKobo,
    totalPaidKobo: safePaidKobo,
    outstandingBalanceKobo,
    overpaymentKobo,
    agreedAmount: fromKobo(safeAgreedKobo),
    totalPaid: fromKobo(safePaidKobo),
    outstandingBalance: fromKobo(outstandingBalanceKobo),
    overpayment: fromKobo(overpaymentKobo),
  };
}

export function formatKobo(kobo: number | null | undefined, showDecimals: boolean = false): string {
  return formatNaira(fromKobo(kobo ?? 0), showDecimals);
}

export function formatKoboCompact(kobo: number | null | undefined): string {
  return formatNairaCompact(fromKobo(kobo ?? 0));
}
