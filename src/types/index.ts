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

export interface ProjectSettings {
  id: string;
  ownerId?: string;
  name: string;
  code: string;
  stage: string;
  handoverDate: string;
  budgetCap: number; // in Naira (e.g. 27000000)
  budgetCapKobo?: number; // integer kobo (e.g. 2700000000)
  activeArtisans: number;
  location: string;
  currencySymbol: string;
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
  avgUnitPrice: number; // weighted average unit price in Naira
  avgUnitPriceKobo?: number; // weighted average unit price in kobo
  totalCost: number; // total acquisition cost spent on this material
  totalCostKobo?: number;
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
  unitPrice: number;
  unitPriceKobo?: number;
  materialCost: number; // quantity * unitPrice
  materialCostKobo?: number;
  haulageCost: number;
  haulageCostKobo?: number;
  offloadingCost: number;
  offloadingCostKobo?: number;
  otherCost: number;
  otherCostKobo?: number;
  acquisitionCost: number; // Landed Acquisition Cost
  acquisitionCostKobo?: number;
  amountPaid: number; // Cash paid to supplier
  amountPaidKobo?: number;
  supplierBalance: number; // Outstanding liability
  supplierBalanceKobo?: number;
  supplierOverpayment?: number;
  supplierOverpaymentKobo?: number;
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
  expectedBudget: number; // Milestone/stream budget
  actualPaid: number; // Actual disbursed
  outstanding: number; // expectedBudget - actualPaid (unbilled/remaining budget)
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
  agreedAmount: number; // Contractual obligation in Naira
  agreedAmountKobo?: number;
  totalPaid: number; // Total payments logged in Naira
  totalPaidKobo?: number;
  outstandingBalance: number; // max(0, agreedAmount - totalPaid)
  outstandingBalanceKobo?: number;
  overpayment?: number; // max(0, totalPaid - agreedAmount) if paid > agreed
  overpaymentKobo?: number;
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
  amount: number; // Payment in Naira
  amountKobo?: number;
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
  cost: number;
  costKobo?: number;
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
  amount: number;
  amountKobo?: number;
  date: string;
  paidBy: string;
  receiptRef?: string;
  notes?: string;
  createdAt: string;
}

export type BudgetHealthStatus = 'Under Budget' | 'Watch Ceiling' | 'Near Budget' | 'Over Budget';

export interface BudgetCostItem {
  id: string;
  category: 'Materials' | 'Labour' | 'Transportation' | 'Other Expenses';
  budget: number;
  actual: number;
  allocatedBudget: number;
  actualSpent: number;
  variance: number; // budget - actual
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
    | 'System';
  entityId: string;
  summary: string;
}

export interface AggregatedMetrics {
  project: ProjectSettings;
  cashExpenditure: number; // Total Cash Paid across all streams
  committedCost: number;   // Total Incurred contractual/landed obligations
  totalSpent: number;      // Primary metric (committed landed spend)
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
