export type MaterialCategory =
  | 'POP'
  | 'Tiles'
  | 'Cement'
  | 'Sand'
  | 'Plumbing'
  | 'Electrical'
  | 'Paint'
  | 'Aluminium'
  | 'Carpentry'
  | 'Doors'
  | 'Windows'
  | 'Masonry'
  | 'Other';

export type WorkStatus = 'Not Started' | 'In Progress' | 'Completed' | 'On Hold';

export type ExpenseCategory =
  | 'Fuel'
  | 'Tools'
  | 'Site logistics'
  | 'Repairs'
  | 'Security'
  | 'Utilities'
  | 'Miscellaneous'
  | 'Other';

export type PaymentMethod = 'Transfer' | 'Cash' | 'Cheque';

export type SyncStatus = 'synced' | 'saving' | 'error' | 'offline';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
}

export interface ProjectSettings {
  id: string;
  ownerId?: string;
  name: string;
  code: string;
  stage: string;
  startDate?: string;
  status?: string;
  handoverDate: string;
  budgetCapKobo: number; // authoritative integer kobo (e.g. 2700000000)
  budgetCap: number; // derived Naira amount (fromKobo(budgetCapKobo))
  activeArtisans: number;
  location: string;
  currencySymbol: string;
  currency?: string;
  timezone: string;
  siteAddress?: string;
  projectManager?: string;
  clientName?: string;
  appTitle?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Material {
  id: string;
  projectId?: string;
  ownerId?: string;
  name: string;
  category: MaterialCategory;
  unit: string; // e.g. 'boxes', 'bags', 'drums', 'lengths'
  totalPurchased: number;
  totalUsed: number;
  remaining: number; // totalPurchased - totalUsed (always >= 0)
  avgUnitPriceKobo: number; // authoritative weighted average unit price in integer kobo
  totalCostKobo: number; // authoritative total acquisition cost in integer kobo
  unitPriceKobo?: number; // alias
  avgUnitPrice: number; // derived Naira (fromKobo(avgUnitPriceKobo))
  totalCost: number; // derived Naira (fromKobo(totalCostKobo))
  supplier: string;
  lotNumber?: string;
  image?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseRecord {
  id: string;
  projectId?: string;
  ownerId?: string;
  materialId?: string;
  materialName: string;
  category: MaterialCategory;
  quantity: number;
  unit: string;
  // Authoritative integer kobo fields
  unitPriceKobo: number;
  materialCostKobo: number;
  haulageCostKobo: number;
  offloadingCostKobo: number;
  otherCostKobo: number;
  acquisitionCostKobo: number; // Landed Acquisition Cost in integer kobo
  amountPaidKobo: number; // Cash paid to supplier in integer kobo
  supplierBalanceKobo: number; // Outstanding liability in integer kobo
  supplierOverpaymentKobo: number; // Overpayment in integer kobo
  // Derived Naira fields
  unitPrice: number;
  materialCost: number;
  haulageCost: number;
  offloadingCost: number;
  otherCost: number;
  acquisitionCost: number;
  amountPaid: number;
  supplierBalance: number;
  supplierOverpayment: number;
  supplier: string;
  purchaseDate: string;
  transportRecordId?: string; // Explicit link to separate transport record if exists
  waybillRef?: string;
  notes?: string;
  voucherImage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialUsage {
  id: string;
  projectId?: string;
  ownerId?: string;
  materialId: string; // Authoritative reference to Material
  materialName: string;
  quantityUsed: number;
  unit: string;
  workArea: string; // e.g. "Penthouse Suite & Master Bed"
  subcontractor?: string;
  date: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkProgressItem {
  id: string;
  projectId?: string;
  ownerId?: string;
  name: string;
  category: string;
  status: WorkStatus;
  completionPercent: number; // 0 - 100
  // Authoritative integer kobo fields
  expectedBudgetKobo: number;
  actualPaidKobo: number;
  outstandingKobo: number;
  // Derived Naira fields
  expectedBudget: number;
  actualPaid: number;
  outstanding: number;
  startDate: string;
  targetDate: string;
  zone?: string;
  snagNotes?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contractor {
  id: string;
  projectId?: string;
  ownerId?: string;
  name: string;
  trade: string; // e.g. "Tiling", "POP Plaster", "Plumbing"
  workDescription: string;
  // Authoritative integer kobo fields
  agreedAmountKobo: number;
  totalPaidKobo: number;
  outstandingBalanceKobo: number;
  overpaymentKobo: number;
  // Derived Naira fields
  agreedAmount: number;
  totalPaid: number;
  outstandingBalance: number;
  overpayment: number;
  avatar?: string;
  isVerified: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabourPayment {
  id: string;
  projectId?: string;
  ownerId?: string;
  contractorId: string; // Authoritative reference to Contractor
  contractorName: string;
  trade: string;
  // Authoritative integer kobo
  amountKobo: number;
  // Derived Naira
  amount: number;
  milestoneTitle: string; // e.g. "1st Tranche - Screeding & Layout"
  paymentMethod: PaymentMethod;
  paymentDate: string;
  receiptRef?: string;
  notes?: string;
  createdAt: string;
}

export interface TransportationRecord {
  id: string;
  projectId?: string;
  ownerId?: string;
  purchaseId?: string; // Explicit link to PurchaseRecord. If linked, haulage is consolidated with purchase to avoid double-counting.
  date: string;
  itemTransported: string;
  quantityDescription: string;
  from: string;
  to: string;
  transporter: string;
  // Authoritative integer kobo
  costKobo: number;
  // Derived Naira
  cost: number;
  waybillRef?: string;
  notes?: string;
  createdAt: string;
}

export interface OtherExpenseRecord {
  id: string;
  projectId?: string;
  ownerId?: string;
  category: ExpenseCategory;
  description: string;
  // Authoritative integer kobo
  amountKobo: number;
  // Derived Naira
  amount: number;
  date: string;
  paidBy: string;
  receiptRef?: string;
  notes?: string;
  createdAt: string;
}

export type BudgetHealthStatus = 'Under Budget' | 'Watch Ceiling' | 'Near Budget' | 'Over Budget';

export interface CategoryBudgetRecord {
  id: string;
  projectId: string;
  ownerId: string;
  category: string;
  budgetKobo: number;
  budget: number;
  updatedAt: string;
}

export interface BudgetCostItem {
  id: string;
  category: 'Materials' | 'Labour' | 'Transportation' | 'Other Expenses';
  // Authoritative integer kobo
  budgetKobo: number;
  actualKobo: number;
  allocatedBudgetKobo: number;
  actualSpentKobo: number;
  varianceKobo: number; // budgetKobo - actualKobo
  remainingKobo: number;
  // Derived Naira
  budget: number;
  actual: number;
  allocatedBudget: number;
  actualSpent: number;
  variance: number;
  remaining: number;
  percentUsed: number;
  status: BudgetHealthStatus;
}

export interface AuditEvent {
  id: string;
  projectId?: string;
  ownerId?: string;
  timestamp: string;
  user: string;
  userEmail?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESET' | 'RESTORE';
  entity:
    | 'Purchase'
    | 'Material'
    | 'MaterialUsage'
    | 'Contractor'
    | 'LabourPayment'
    | 'Transportation'
    | 'OtherExpense'
    | 'WorkProgress'
    | 'ProjectSettings'
    | 'System'
    | string;
  entityType?: string;
  entityId: string;
  summary: string;
  details?: string;
}

export interface AggregatedMetrics {
  project: ProjectSettings;
  // Authoritative integer kobo aggregates
  cashExpenditureKobo: number;
  committedCostKobo: number;
  totalSpentKobo: number;
  budgetCapKobo: number;
  remainingBufferKobo: number;
  totalOutstandingKobo: number;
  supplierOutstandingKobo: number;
  contractorOutstandingKobo: number;
  totalOverpaymentsKobo: number;
  supplierOverpaymentKobo: number;
  contractorOverpaymentKobo: number;
  materialSpentKobo: number;
  labourSpentKobo: number;
  transportationSpentKobo: number;
  otherSpentKobo: number;
  directTransportSpentKobo: number;
  purchaseHaulageSpentKobo: number;
  stockInStoreValueKobo: number;
  // Derived Naira aggregates
  cashExpenditure: number; // Total Cash Paid across all streams
  committedCost: number; // Total Incurred contractual/landed obligations
  totalSpent: number; // Primary metric (committed landed spend)
  budgetCap: number;
  remainingBuffer: number; // budgetCap - totalSpent
  contingencyPercent: number;
  spentPercent: number;
  totalOutstanding: number; // Total unpaid liabilities
  supplierOutstanding: number;
  contractorOutstanding: number;
  totalOverpayments: number;
  supplierOverpayment: number;
  contractorOverpayment: number;
  forecastRemainingCost: number;
  materialSpent: number;
  labourSpent: number;
  transportationSpent: number;
  otherSpent: number;
  directTransportSpent: number;
  purchaseHaulageSpent: number;
  stockInStoreValue: number;
  lowStockCount: number;
  depletedCount: number;
  budgetCategories: BudgetCostItem[];
  materialsCount: number;
  activeStreamsCount: number;
  overallCompletionPercent: number;
}
