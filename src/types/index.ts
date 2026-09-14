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
  name: string;
  code: string;
  stage: string;
  handoverDate: string;
  budgetCap: number; // in Naira (e.g. 27000000)
  activeArtisans: number;
  location: string;
  currencySymbol: string;
  timezone: string;
  siteAddress?: string;
  projectManager?: string;
}

export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  unit: string; // e.g. 'boxes', 'bags', 'drums', 'lengths'
  totalPurchased: number;
  totalUsed: number;
  remaining: number; // totalPurchased - totalUsed
  avgUnitPrice: number; // weighted average unit price
  totalCost: number; // total cost spent on this material
  supplier: string;
  lotNumber?: string;
  image?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseRecord {
  id: string;
  materialId?: string;
  materialName: string;
  category: MaterialCategory;
  quantity: number;
  unit: string;
  unitPrice: number;
  materialCost: number; // quantity * unitPrice
  haulageCost: number;
  offloadingCost: number;
  otherCost: number;
  acquisitionCost: number; // materialCost + haulageCost + offloadingCost + otherCost
  amountPaid: number;
  supplierBalance: number; // acquisitionCost - amountPaid
  supplier: string;
  purchaseDate: string;
  waybillRef?: string;
  notes?: string;
  voucherImage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialUsage {
  id: string;
  materialId: string;
  materialName: string;
  quantityUsed: number;
  unit: string;
  workArea: string; // e.g. "Penthouse Suite & Master Bed"
  subcontractor?: string;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface WorkProgressItem {
  id: string;
  name: string;
  category: string;
  status: WorkStatus;
  completionPercent: number; // 0 - 100
  expectedBudget: number;
  actualPaid: number;
  outstanding: number; // expectedBudget - actualPaid
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
  name: string;
  trade: string; // e.g. "Tiling", "POP Plaster", "Plumbing"
  workDescription: string;
  agreedAmount: number;
  totalPaid: number;
  outstandingBalance: number; // agreedAmount - totalPaid
  avatar?: string;
  isVerified: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabourPayment {
  id: string;
  contractorId: string;
  contractorName: string;
  trade: string;
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
  date: string;
  itemTransported: string;
  quantityDescription: string;
  from: string;
  to: string;
  transporter: string;
  cost: number;
  waybillRef?: string;
  notes?: string;
  createdAt: string;
}

export interface OtherExpenseRecord {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
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
