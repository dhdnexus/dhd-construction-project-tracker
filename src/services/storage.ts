import {
  ProjectSettings,
  Material,
  PurchaseRecord,
  MaterialUsage,
  WorkProgressItem,
  Contractor,
  LabourPayment,
  TransportationRecord,
  OtherExpenseRecord,
  BudgetCostItem,
} from '../types';
import {
  initialProject,
  initialMaterials,
  initialPurchases,
  initialUsage,
  initialWorkProgress,
  initialContractors,
  initialLabourPayments,
  initialTransportation,
  initialOtherExpenses,
} from '../data/seedData';
import { calculatePurchaseTotals } from '../utils/formatters';

const STORAGE_KEYS = {
  PROJECT: 'dhd_project_v1',
  MATERIALS: 'dhd_materials_v1',
  PURCHASES: 'dhd_purchases_v1',
  USAGE: 'dhd_usage_v1',
  WORK_PROGRESS: 'dhd_work_progress_v1',
  CONTRACTORS: 'dhd_contractors_v1',
  LABOUR_PAYMENTS: 'dhd_labour_payments_v1',
  TRANSPORTATION: 'dhd_transportation_v1',
  OTHER_EXPENSES: 'dhd_other_expenses_v1',
  CATEGORY_BUDGETS: 'dhd_category_budgets_v1',
  INITIALIZED: 'dhd_initialized_v1',
};

// Custom event dispatcher for reactive component updates
export const STORAGE_UPDATE_EVENT = 'dhd_storage_update';

function notifySubscribers() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(STORAGE_UPDATE_EVENT));
  }
}

function getStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    if (!item || item === 'undefined' || item === 'null') return fallback;
    const parsed = JSON.parse(item);
    return parsed !== null && parsed !== undefined ? (parsed as T) : fallback;
  } catch (err) {
    console.error(`Error reading ${key} from storage:`, err);
    return fallback;
  }
}

function setStored<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    notifySubscribers();
  } catch (err) {
    console.error(`Error writing ${key} to storage:`, err);
  }
}

export class ConstructionTrackerService {
  public static initialize(): void {
    if (typeof window === 'undefined') return;
    const isInit = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!isInit) {
      this.resetToSeedData();
    }
  }

  public static resetToSeedData(): void {
    setStored(STORAGE_KEYS.PROJECT, initialProject);
    setStored(STORAGE_KEYS.MATERIALS, initialMaterials);
    setStored(STORAGE_KEYS.PURCHASES, initialPurchases);
    setStored(STORAGE_KEYS.USAGE, initialUsage);
    setStored(STORAGE_KEYS.WORK_PROGRESS, initialWorkProgress);
    setStored(STORAGE_KEYS.CONTRACTORS, initialContractors);
    setStored(STORAGE_KEYS.LABOUR_PAYMENTS, initialLabourPayments);
    setStored(STORAGE_KEYS.TRANSPORTATION, initialTransportation);
    setStored(STORAGE_KEYS.OTHER_EXPENSES, initialOtherExpenses);
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    notifySubscribers();
  }

  public static clearAllData(): void {
    setStored(STORAGE_KEYS.PROJECT, {
      ...initialProject,
      name: 'New Finishing Site',
      code: '#SITE-001',
      stage: 'Finishing Phase',
      budgetCap: 20000000,
      activeArtisans: 0,
    });
    setStored(STORAGE_KEYS.MATERIALS, []);
    setStored(STORAGE_KEYS.PURCHASES, []);
    setStored(STORAGE_KEYS.USAGE, []);
    setStored(STORAGE_KEYS.WORK_PROGRESS, []);
    setStored(STORAGE_KEYS.CONTRACTORS, []);
    setStored(STORAGE_KEYS.LABOUR_PAYMENTS, []);
    setStored(STORAGE_KEYS.TRANSPORTATION, []);
    setStored(STORAGE_KEYS.OTHER_EXPENSES, []);
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    notifySubscribers();
  }

  // ==================== PROJECT ====================
  public static getProject(): ProjectSettings {
    const proj = getStored<ProjectSettings>(STORAGE_KEYS.PROJECT, initialProject);
    if (!proj || typeof proj !== 'object' || !proj.name) {
      return initialProject;
    }
    return {
      ...initialProject,
      ...proj,
    };
  }

  public static updateProject(updates: Partial<ProjectSettings>): ProjectSettings {
    const current = this.getProject();
    const updated = { ...current, ...updates };
    setStored(STORAGE_KEYS.PROJECT, updated);
    return updated;
  }

  // ==================== MATERIALS ====================
  public static getMaterials(): Material[] {
    return getStored<Material[]>(STORAGE_KEYS.MATERIALS, initialMaterials);
  }

  public static getMaterialById(id: string): Material | undefined {
    return this.getMaterials().find((m) => m.id === id);
  }

  public static saveMaterial(material: Omit<Material, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Material {
    const materials = this.getMaterials();
    const now = new Date().toISOString();

    if (material.id) {
      // Update
      const index = materials.findIndex((m) => m.id === material.id);
      if (index === -1) throw new Error('Material not found');
      const updated: Material = {
        ...materials[index],
        ...material,
        id: material.id,
        remaining: Math.max(0, material.totalPurchased - material.totalUsed),
        updatedAt: now,
      };
      materials[index] = updated;
      setStored(STORAGE_KEYS.MATERIALS, materials);
      return updated;
    } else {
      // Create
      const newMat: Material = {
        ...material,
        id: `mat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        remaining: Math.max(0, material.totalPurchased - material.totalUsed),
        createdAt: now,
        updatedAt: now,
      };
      materials.unshift(newMat);
      setStored(STORAGE_KEYS.MATERIALS, materials);
      return newMat;
    }
  }

  public static deleteMaterial(id: string): void {
    const materials = this.getMaterials().filter((m) => m.id !== id);
    setStored(STORAGE_KEYS.MATERIALS, materials);
  }

  // ==================== PURCHASES ====================
  public static getPurchases(): PurchaseRecord[] {
    return getStored<PurchaseRecord[]>(STORAGE_KEYS.PURCHASES, initialPurchases);
  }

  public static savePurchase(data: Omit<PurchaseRecord, 'id' | 'materialCost' | 'acquisitionCost' | 'supplierBalance' | 'createdAt' | 'updatedAt'> & { id?: string }): PurchaseRecord {
    const purchases = this.getPurchases();
    const now = new Date().toISOString();

    // Auto calculations per Section 8
    const { materialCost, acquisitionCost, supplierBalance } = calculatePurchaseTotals(
      data.quantity,
      data.unitPrice,
      data.haulageCost || 0,
      data.offloadingCost || 0,
      data.otherCost || 0,
      data.amountPaid || 0
    );

    let savedPurchase: PurchaseRecord;

    if (data.id) {
      // Edit
      const index = purchases.findIndex((p) => p.id === data.id);
      if (index === -1) throw new Error('Purchase record not found');
      savedPurchase = {
        ...purchases[index],
        ...data,
        id: data.id,
        materialCost,
        acquisitionCost,
        supplierBalance,
        updatedAt: now,
      };
      purchases[index] = savedPurchase;
    } else {
      // Create
      savedPurchase = {
        ...data,
        id: `pur_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        materialCost,
        acquisitionCost,
        supplierBalance,
        createdAt: now,
        updatedAt: now,
      };
      purchases.unshift(savedPurchase);
    }

    setStored(STORAGE_KEYS.PURCHASES, purchases);

    // Synchronize material inventory
    this.syncMaterialStockFromPurchases(savedPurchase.materialName, savedPurchase.category, savedPurchase.unit);

    return savedPurchase;
  }

  public static deletePurchase(id: string): void {
    const purchases = this.getPurchases();
    const target = purchases.find((p) => p.id === id);
    const filtered = purchases.filter((p) => p.id !== id);
    setStored(STORAGE_KEYS.PURCHASES, filtered);

    if (target) {
      this.syncMaterialStockFromPurchases(target.materialName, target.category, target.unit);
    }
  }

  private static syncMaterialStockFromPurchases(materialName: string, category: any, unit: string): void {
    const purchases = this.getPurchases().filter(
      (p) => p.materialName.toLowerCase().trim() === materialName.toLowerCase().trim()
    );
    const usages = this.getMaterialUsage().filter(
      (u) => u.materialName.toLowerCase().trim() === materialName.toLowerCase().trim()
    );

    const totalPurchased = purchases.reduce((sum, p) => sum + p.quantity, 0);
    const totalMaterialCost = purchases.reduce((sum, p) => sum + p.materialCost, 0);
    const avgUnitPrice = totalPurchased > 0 ? Math.round(totalMaterialCost / totalPurchased) : 0;
    const totalUsed = usages.reduce((sum, u) => sum + u.quantityUsed, 0);
    const remaining = Math.max(0, totalPurchased - totalUsed);

    const materials = this.getMaterials();
    const existingIndex = materials.findIndex(
      (m) => m.name.toLowerCase().trim() === materialName.toLowerCase().trim()
    );

    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      materials[existingIndex] = {
        ...materials[existingIndex],
        totalPurchased,
        totalUsed,
        remaining,
        avgUnitPrice,
        totalCost: totalMaterialCost,
        updatedAt: now,
      };
      setStored(STORAGE_KEYS.MATERIALS, materials);
    } else if (totalPurchased > 0) {
      const newMat: Material = {
        id: `mat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: materialName,
        category,
        unit,
        totalPurchased,
        totalUsed,
        remaining,
        avgUnitPrice,
        totalCost: totalMaterialCost,
        supplier: purchases[0]?.supplier || 'Direct Consignment',
        createdAt: now,
        updatedAt: now,
      };
      materials.unshift(newMat);
      setStored(STORAGE_KEYS.MATERIALS, materials);
    }
  }

  // ==================== MATERIAL USAGE ====================
  public static getMaterialUsage(): MaterialUsage[] {
    return getStored<MaterialUsage[]>(STORAGE_KEYS.USAGE, initialUsage);
  }

  public static saveUsage(data: Omit<MaterialUsage, 'id' | 'createdAt'> & { id?: string }): MaterialUsage {
    const usages = this.getMaterialUsage();
    const now = new Date().toISOString();

    // Check available stock to prevent negative stock (Section 9)
    const materials = this.getMaterials();
    const mat = materials.find(
      (m) => m.id === data.materialId || m.name.toLowerCase().trim() === data.materialName.toLowerCase().trim()
    );

    if (mat) {
      // Calculate remaining without this specific usage (if editing)
      const currentUsageTotal = usages
        .filter((u) => u.materialName.toLowerCase().trim() === mat.name.toLowerCase().trim() && u.id !== data.id)
        .reduce((sum, u) => sum + u.quantityUsed, 0);
      const availableForThis = mat.totalPurchased - currentUsageTotal;

      if (data.quantityUsed > availableForThis) {
        throw new Error(
          `Requested usage (${data.quantityUsed} ${data.unit}) exceeds available stock (${availableForThis} ${data.unit}). Negative stock is not allowed.`
        );
      }
    }

    let savedUsage: MaterialUsage;
    if (data.id) {
      const index = usages.findIndex((u) => u.id === data.id);
      if (index === -1) throw new Error('Usage record not found');
      savedUsage = { ...usages[index], ...data, id: data.id };
      usages[index] = savedUsage;
    } else {
      savedUsage = {
        ...data,
        id: `use_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        createdAt: now,
      };
      usages.unshift(savedUsage);
    }

    setStored(STORAGE_KEYS.USAGE, usages);

    // Update material remaining quantity
    if (mat) {
      this.syncMaterialStockFromPurchases(mat.name, mat.category, mat.unit);
    }

    return savedUsage;
  }

  public static deleteUsage(id: string): void {
    const usages = this.getMaterialUsage();
    const target = usages.find((u) => u.id === id);
    const filtered = usages.filter((u) => u.id !== id);
    setStored(STORAGE_KEYS.USAGE, filtered);

    if (target) {
      this.syncMaterialStockFromPurchases(target.materialName, 'Other', target.unit);
    }
  }

  // ==================== WORK PROGRESS ====================
  public static getWorkProgress(): WorkProgressItem[] {
    return getStored<WorkProgressItem[]>(STORAGE_KEYS.WORK_PROGRESS, initialWorkProgress);
  }

  public static saveWorkProgress(data: Omit<WorkProgressItem, 'id' | 'outstanding' | 'createdAt' | 'updatedAt'> & { id?: string }): WorkProgressItem {
    const items = this.getWorkProgress();
    const now = new Date().toISOString();
    const safePercent = Math.min(100, Math.max(0, Math.round(data.completionPercent || 0)));
    const safeExpected = Math.max(0, data.expectedBudget || 0);
    const safeActualPaid = Math.max(0, data.actualPaid || 0);
    const outstanding = Math.max(0, safeExpected - safeActualPaid);

    let saved: WorkProgressItem;
    if (data.id) {
      const index = items.findIndex((i) => i.id === data.id);
      if (index === -1) throw new Error('Work stream not found');
      saved = {
        ...items[index],
        ...data,
        id: data.id,
        completionPercent: safePercent,
        expectedBudget: safeExpected,
        actualPaid: safeActualPaid,
        outstanding,
        updatedAt: now,
      };
      items[index] = saved;
    } else {
      saved = {
        ...data,
        id: `wp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        completionPercent: safePercent,
        expectedBudget: safeExpected,
        actualPaid: safeActualPaid,
        outstanding,
        createdAt: now,
        updatedAt: now,
      };
      items.push(saved);
    }

    setStored(STORAGE_KEYS.WORK_PROGRESS, items);
    return saved;
  }

  public static updateWorkPercent(id: string, newPercent: number): void {
    const items = this.getWorkProgress();
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const safePercent = Math.min(100, Math.max(0, Math.round(newPercent)));
    item.completionPercent = safePercent;
    if (safePercent === 100) {
      item.status = 'Completed';
    } else if (safePercent > 0 && item.status === 'Not Started') {
      item.status = 'In Progress';
    }
    item.updatedAt = new Date().toISOString();
    setStored(STORAGE_KEYS.WORK_PROGRESS, items);
  }

  public static deleteWorkProgress(id: string): void {
    const items = this.getWorkProgress().filter((i) => i.id !== id);
    setStored(STORAGE_KEYS.WORK_PROGRESS, items);
  }

  // ==================== CONTRACTORS ====================
  public static getContractors(): Contractor[] {
    return getStored<Contractor[]>(STORAGE_KEYS.CONTRACTORS, initialContractors);
  }

  public static saveContractor(data: Omit<Contractor, 'id' | 'totalPaid' | 'outstandingBalance' | 'createdAt' | 'updatedAt'> & { id?: string; totalPaid?: number }): Contractor {
    const contractors = this.getContractors();
    const now = new Date().toISOString();

    const safeAgreed = Math.max(0, data.agreedAmount || 0);

    let saved: Contractor;
    if (data.id) {
      const index = contractors.findIndex((c) => c.id === data.id);
      if (index === -1) throw new Error('Contractor not found');
      const currentPaid = contractors[index].totalPaid;
      const outstanding = Math.max(0, safeAgreed - currentPaid);

      saved = {
        ...contractors[index],
        ...data,
        id: data.id,
        agreedAmount: safeAgreed,
        totalPaid: currentPaid,
        outstandingBalance: outstanding,
        updatedAt: now,
      };
      contractors[index] = saved;
    } else {
      saved = {
        ...data,
        id: `cont_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        agreedAmount: safeAgreed,
        totalPaid: 0,
        outstandingBalance: safeAgreed,
        createdAt: now,
        updatedAt: now,
      };
      contractors.unshift(saved);
    }

    setStored(STORAGE_KEYS.CONTRACTORS, contractors);
    return saved;
  }

  public static deleteContractor(id: string): void {
    const contractors = this.getContractors().filter((c) => c.id !== id);
    setStored(STORAGE_KEYS.CONTRACTORS, contractors);
  }

  // ==================== LABOUR PAYMENTS ====================
  public static getLabourPayments(): LabourPayment[] {
    return getStored<LabourPayment[]>(STORAGE_KEYS.LABOUR_PAYMENTS, initialLabourPayments);
  }

  public static saveLabourPayment(data: Omit<LabourPayment, 'id' | 'createdAt'> & { id?: string }): LabourPayment {
    const payments = this.getLabourPayments();
    const now = new Date().toISOString();
    const safeAmount = Math.max(0, data.amount || 0);

    let saved: LabourPayment;
    if (data.id) {
      const index = payments.findIndex((p) => p.id === data.id);
      if (index === -1) throw new Error('Payment not found');
      saved = {
        ...payments[index],
        ...data,
        id: data.id,
        amount: safeAmount,
      };
      payments[index] = saved;
    } else {
      saved = {
        ...data,
        id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        amount: safeAmount,
        createdAt: now,
      };
      payments.unshift(saved);
    }

    setStored(STORAGE_KEYS.LABOUR_PAYMENTS, payments);

    // Sync contractor balance (Section 11)
    this.syncContractorPaymentTotals(saved.contractorId);

    return saved;
  }

  public static deleteLabourPayment(id: string): void {
    const payments = this.getLabourPayments();
    const target = payments.find((p) => p.id === id);
    const filtered = payments.filter((p) => p.id !== id);
    setStored(STORAGE_KEYS.LABOUR_PAYMENTS, filtered);

    if (target) {
      this.syncContractorPaymentTotals(target.contractorId);
    }
  }

  private static syncContractorPaymentTotals(contractorId: string): void {
    const payments = this.getLabourPayments().filter((p) => p.contractorId === contractorId);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    const contractors = this.getContractors();
    const index = contractors.findIndex((c) => c.id === contractorId);
    if (index >= 0) {
      const agreed = contractors[index].agreedAmount;
      contractors[index] = {
        ...contractors[index],
        totalPaid,
        outstandingBalance: Math.max(0, agreed - totalPaid),
        updatedAt: new Date().toISOString(),
      };
      setStored(STORAGE_KEYS.CONTRACTORS, contractors);
    }
  }

  // ==================== TRANSPORTATION ====================
  public static getTransportation(): TransportationRecord[] {
    return getStored<TransportationRecord[]>(STORAGE_KEYS.TRANSPORTATION, initialTransportation);
  }

  public static saveTransportation(data: Omit<TransportationRecord, 'id' | 'createdAt'> & { id?: string }): TransportationRecord {
    const records = this.getTransportation();
    const now = new Date().toISOString();
    const safeCost = Math.max(0, data.cost || 0);

    let saved: TransportationRecord;
    if (data.id) {
      const index = records.findIndex((r) => r.id === data.id);
      if (index === -1) throw new Error('Transportation record not found');
      saved = { ...records[index], ...data, id: data.id, cost: safeCost };
      records[index] = saved;
    } else {
      saved = {
        ...data,
        id: `trans_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        cost: safeCost,
        createdAt: now,
      };
      records.unshift(saved);
    }

    setStored(STORAGE_KEYS.TRANSPORTATION, records);
    return saved;
  }

  public static deleteTransportation(id: string): void {
    const records = this.getTransportation().filter((r) => r.id !== id);
    setStored(STORAGE_KEYS.TRANSPORTATION, records);
  }

  // ==================== OTHER EXPENSES ====================
  public static getOtherExpenses(): OtherExpenseRecord[] {
    return getStored<OtherExpenseRecord[]>(STORAGE_KEYS.OTHER_EXPENSES, initialOtherExpenses);
  }

  public static saveOtherExpense(data: Omit<OtherExpenseRecord, 'id' | 'createdAt'> & { id?: string }): OtherExpenseRecord {
    const records = this.getOtherExpenses();
    const now = new Date().toISOString();
    const safeAmount = Math.max(0, data.amount || 0);

    let saved: OtherExpenseRecord;
    if (data.id) {
      const index = records.findIndex((r) => r.id === data.id);
      if (index === -1) throw new Error('Expense record not found');
      saved = { ...records[index], ...data, id: data.id, amount: safeAmount };
      records[index] = saved;
    } else {
      saved = {
        ...data,
        id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        amount: safeAmount,
        createdAt: now,
      };
      records.unshift(saved);
    }

    setStored(STORAGE_KEYS.OTHER_EXPENSES, records);
    return saved;
  }

  public static deleteOtherExpense(id: string): void {
    const records = this.getOtherExpenses().filter((r) => r.id !== id);
    setStored(STORAGE_KEYS.OTHER_EXPENSES, records);
  }

  // ==================== AGGREGATED METRICS & BUDGETS ====================
  public static getAggregatedMetrics() {
    const project = this.getProject();
    const materials = this.getMaterials();
    const purchases = this.getPurchases();
    const workProgress = this.getWorkProgress();
    const contractors = this.getContractors();
    const labourPayments = this.getLabourPayments();
    const transportation = this.getTransportation();
    const otherExpenses = this.getOtherExpenses();

    // Actual spending categories (Section 6 & 14)
    // Materials actual = total acquisition spent on purchases
    const materialSpent = purchases.reduce((sum, p) => sum + p.acquisitionCost, 0);
    // Labour actual = total disbursements logged
    const labourSpent = labourPayments.reduce((sum, p) => sum + p.amount, 0);
    // Transportation = haulage records logged
    const transportationSpent = transportation.reduce((sum, t) => sum + t.cost, 0);
    // Other expenses = sundry logged
    const otherSpent = otherExpenses.reduce((sum, e) => sum + e.amount, 0);

    const totalSpent = materialSpent + labourSpent + transportationSpent + otherSpent;
    const budgetCap = project.budgetCap || 27000000;
    const remainingBuffer = Math.max(0, budgetCap - totalSpent);
    const contingencyPercent = budgetCap > 0 ? Number(((remainingBuffer / budgetCap) * 100).toFixed(1)) : 0;
    const spentPercent = budgetCap > 0 ? Number(((totalSpent / budgetCap) * 100).toFixed(1)) : 0;

    // Outstanding Payables:
    // 1. Supplier unpaid balances
    const supplierOutstanding = purchases.reduce((sum, p) => sum + p.supplierBalance, 0);
    // 2. Contractor unpaid balances
    const contractorOutstanding = contractors.reduce((sum, c) => sum + c.outstandingBalance, 0);
    const totalOutstanding = supplierOutstanding + contractorOutstanding;

    // Overall Completion Percentage (weighted by expected budget or average of streams)
    let overallCompletionPercent = 0;
    if (workProgress.length > 0) {
      const totalBudgetStreams = workProgress.reduce((sum, w) => sum + w.expectedBudget, 0);
      if (totalBudgetStreams > 0) {
        const weightedCompleted = workProgress.reduce(
          (sum, w) => sum + (w.expectedBudget * w.completionPercent) / 100,
          0
        );
        overallCompletionPercent = Math.round((weightedCompleted / totalBudgetStreams) * 100);
      } else {
        const sumPercents = workProgress.reduce((sum, w) => sum + w.completionPercent, 0);
        overallCompletionPercent = Math.round(sumPercents / workProgress.length);
      }
    }

    // Site stock value: current in-store value = sum(remaining * avgUnitPrice)
    const stockInStoreValue = materials.reduce((sum, m) => sum + m.remaining * m.avgUnitPrice, 0);
    const lowStockCount = materials.filter((m) => m.remaining > 0 && m.remaining <= 10).length;
    const depletedCount = materials.filter((m) => m.remaining === 0).length;

    // Budget vs Actual categories matrix (Section 14)
    const catBudgets = this.getCategoryBudgets();
    const budgetCategories: BudgetCostItem[] = [
      this.calculateBudgetCategory('Materials', catBudgets['Materials'] || 15000000, materialSpent),
      this.calculateBudgetCategory('Labour', catBudgets['Labour'] || 6500000, labourSpent),
      this.calculateBudgetCategory('Transportation', catBudgets['Transportation'] || 1500000, transportationSpent),
      this.calculateBudgetCategory('Other Expenses', catBudgets['Other Expenses'] || 4000000, otherSpent),
    ];

    return {
      project,
      totalSpent,
      budgetCap,
      remainingBuffer,
      contingencyPercent,
      spentPercent,
      totalOutstanding,
      supplierOutstanding,
      contractorOutstanding,
      overallCompletionPercent,
      materialSpent,
      labourSpent,
      transportationSpent,
      otherSpent,
      stockInStoreValue,
      lowStockCount,
      depletedCount,
      budgetCategories,
      materialsCount: materials.length,
      activeStreamsCount: workProgress.filter((w) => w.status === 'In Progress').length,
    };
  }

  public static getCategoryBudgets(): Record<string, number> {
    return getStored<Record<string, number>>(STORAGE_KEYS.CATEGORY_BUDGETS, {
      Materials: 15000000,
      Labour: 6500000,
      Transportation: 1500000,
      'Other Expenses': 4000000,
    });
  }

  public static updateCategoryBudget(category: string, newBudget: number): void {
    const budgets = this.getCategoryBudgets();
    budgets[category] = Math.max(0, newBudget);
    setStored(STORAGE_KEYS.CATEGORY_BUDGETS, budgets);
  }

  private static calculateBudgetCategory(
    category: 'Materials' | 'Labour' | 'Transportation' | 'Other Expenses',
    budget: number,
    actual: number
  ): BudgetCostItem {
    const variance = budget - actual;
    const remaining = Math.max(0, budget - actual);
    const percentUsed = budget > 0 ? Number(((actual / budget) * 100).toFixed(1)) : 0;

    let status: 'Under Budget' | 'Watch Ceiling' | 'Near Budget' | 'Over Budget' = 'Under Budget';
    if (percentUsed > 100) {
      status = 'Over Budget';
    } else if (percentUsed >= 85) {
      status = 'Near Budget';
    } else if (percentUsed >= 75) {
      status = 'Watch Ceiling';
    } else {
      status = 'Under Budget';
    }

    return {
      id: category,
      category,
      budget,
      actual,
      allocatedBudget: budget,
      actualSpent: actual,
      variance,
      remaining,
      percentUsed,
      status,
    };
  }

  // ==================== BACKUP & RESTORE ====================
  public static exportDatabaseJSON(): string {
    const backup = {
      timestamp: new Date().toISOString(),
      project: this.getProject(),
      materials: this.getMaterials(),
      purchases: this.getPurchases(),
      usage: this.getMaterialUsage(),
      workProgress: this.getWorkProgress(),
      contractors: this.getContractors(),
      labourPayments: this.getLabourPayments(),
      transportation: this.getTransportation(),
      otherExpenses: this.getOtherExpenses(),
    };
    return JSON.stringify(backup, null, 2);
  }

  public static importDatabaseJSON(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') return false;

      if (data.project) setStored(STORAGE_KEYS.PROJECT, data.project);
      if (Array.isArray(data.materials)) setStored(STORAGE_KEYS.MATERIALS, data.materials);
      if (Array.isArray(data.purchases)) setStored(STORAGE_KEYS.PURCHASES, data.purchases);
      if (Array.isArray(data.usage)) setStored(STORAGE_KEYS.USAGE, data.usage);
      if (Array.isArray(data.workProgress)) setStored(STORAGE_KEYS.WORK_PROGRESS, data.workProgress);
      if (Array.isArray(data.contractors)) setStored(STORAGE_KEYS.CONTRACTORS, data.contractors);
      if (Array.isArray(data.labourPayments)) setStored(STORAGE_KEYS.LABOUR_PAYMENTS, data.labourPayments);
      if (Array.isArray(data.transportation)) setStored(STORAGE_KEYS.TRANSPORTATION, data.transportation);
      if (Array.isArray(data.otherExpenses)) setStored(STORAGE_KEYS.OTHER_EXPENSES, data.otherExpenses);

      notifySubscribers();
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  }
}
