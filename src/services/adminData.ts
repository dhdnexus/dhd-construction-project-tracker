import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { fromKobo } from '../utils/formatters';

export interface AdminUserRecord {
  id: string;
  email: string | null;
  displayName: string | null;
  role: string;
}

export interface AdminProjectRecord {
  id: string;
  ownerId: string;
  name: string;
  code: string;
  stage: string;
  status: string;
  location: string;
  budgetCapKobo: number;
  budgetCap: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditRecord {
  id: string;
  projectId: string;
  ownerId: string;
  timestamp: string;
  user: string;
  userEmail: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
}

export interface AdminOverview {
  users: AdminUserRecord[];
  projects: AdminProjectRecord[];
  auditEvents: AdminAuditRecord[];
}

export interface AdminProjectIntelligence {
  projectId: string;
  actualSpendKobo: number;
  cashPaidKobo: number;
  outstandingKobo: number;
  supplierOutstandingKobo: number;
  contractorOutstandingKobo: number;
  completionPercent: number;
  materialsKobo: number;
  labourKobo: number;
  transportationKobo: number;
  otherExpensesKobo: number;
  workItems: number;
}

function kobo(data: Record<string, unknown>, koboKey: string, nairaKey: string): number {
  const value = data[koboKey];
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const naira = data[nairaKey];
  return typeof naira === 'number' && Number.isFinite(naira) ? Math.round(naira * 100) : 0;
}

function projectDocs(collectionName: string, projectId: string) {
  return getDocs(query(
    collection(db, collectionName),
    where('projectId', '==', projectId),
    limit(ADMIN_QUERY_LIMIT),
  ));
}

export async function loadAdminProjectIntelligence(projectId: string): Promise<AdminProjectIntelligence> {
  const [
    purchasesSnapshot,
    contractorsSnapshot,
    transportationSnapshot,
    otherExpensesSnapshot,
    workProgressSnapshot,
  ] = await Promise.all([
    projectDocs('purchases', projectId),
    projectDocs('contractors', projectId),
    projectDocs('transportation', projectId),
    projectDocs('otherExpenses', projectId),
    projectDocs('workProgress', projectId),
  ]);

  let materialsKobo = 0;
  let purchaseHaulageKobo = 0;
  let purchaseOffloadingKobo = 0;
  let purchaseOtherKobo = 0;
  let supplierOutstandingKobo = 0;
  let purchaseCashPaidKobo = 0;

  purchasesSnapshot.docs.forEach((snapshot) => {
    const data = snapshot.data() as Record<string, unknown>;
    materialsKobo += kobo(data, 'materialCostKobo', 'materialCost');
    purchaseHaulageKobo += kobo(data, 'haulageCostKobo', 'haulageCost');
    purchaseOffloadingKobo += kobo(data, 'offloadingCostKobo', 'offloadingCost');
    purchaseOtherKobo += kobo(data, 'otherCostKobo', 'otherCost');
    supplierOutstandingKobo += kobo(data, 'supplierBalanceKobo', 'supplierBalance');
    purchaseCashPaidKobo += kobo(data, 'amountPaidKobo', 'amountPaid');
  });

  let directTransportationKobo = 0;
  transportationSnapshot.docs.forEach((snapshot) => {
    const data = snapshot.data() as Record<string, unknown>;
    if (!data.purchaseId) {
      directTransportationKobo += kobo(data, 'costKobo', 'cost');
    }
  });

  const transportationKobo = purchaseHaulageKobo + directTransportationKobo;

  let contractorOutstandingKobo = 0;
  let labourKobo = 0;
  contractorsSnapshot.docs.forEach((snapshot) => {
    const data = snapshot.data() as Record<string, unknown>;
    contractorOutstandingKobo += kobo(data, 'outstandingBalanceKobo', 'outstandingBalance');
  });
  // Labour cost is the recorded cash paid to contractors, matching the tracker
  // aggregation model. Contractor agreed amounts are tracked separately as liabilities.
  const labourPaymentSnapshot = await projectDocs('labourPayments', projectId);
  labourPaymentSnapshot.docs.forEach((snapshot) => {
    const data = snapshot.data() as Record<string, unknown>;
    labourKobo += kobo(data, 'amountKobo', 'amount');
  });

  let otherExpensesKobo = 0;
  const otherExpenseRecords = otherExpensesSnapshot.docs;
  otherExpenseRecords.forEach((snapshot) => {
    const data = snapshot.data() as Record<string, unknown>;
    otherExpensesKobo += kobo(data, 'amountKobo', 'amount');
  });

  let completionNumerator = 0;
  let completionDenominator = 0;
  workProgressSnapshot.docs.forEach((snapshot) => {
    const data = snapshot.data() as Record<string, unknown>;
    const completion = typeof data.completionPercent === 'number' ? data.completionPercent : 0;
    const weight = kobo(data, 'expectedBudgetKobo', 'expectedBudget');
    completionNumerator += Math.max(0, Math.min(100, completion)) * (weight > 0 ? weight : 1);
    completionDenominator += weight > 0 ? weight : 1;
  });

  const actualSpendKobo =
    materialsKobo +
    purchaseOffloadingKobo +
    purchaseOtherKobo +
    transportationKobo +
    labourKobo +
    otherExpensesKobo;

  return {
    projectId,
    actualSpendKobo,
    cashPaidKobo: purchaseCashPaidKobo + labourKobo + directTransportationKobo + otherExpensesKobo,
    outstandingKobo: supplierOutstandingKobo + contractorOutstandingKobo,
    supplierOutstandingKobo,
    contractorOutstandingKobo,
    completionPercent: completionDenominator > 0 ? completionNumerator / completionDenominator : 0,
    materialsKobo,
    labourKobo,
    transportationKobo,
    otherExpensesKobo,
    workItems: workProgressSnapshot.size,
  };
}

const ADMIN_QUERY_LIMIT = 200;

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export async function loadAdminOverview(): Promise<AdminOverview> {
  const [usersSnapshot, projectsSnapshot, auditSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'userProfiles'), limit(ADMIN_QUERY_LIMIT))),
    getDocs(query(collection(db, 'projects'), limit(ADMIN_QUERY_LIMIT))),
    getDocs(query(collection(db, 'auditEvents'), limit(ADMIN_QUERY_LIMIT))),
  ]);

  const users = usersSnapshot.docs
    .map((snapshot) => {
      const data = snapshot.data();
      return {
        id: snapshot.id,
        email: typeof data.email === 'string' ? data.email : null,
        displayName: typeof data.displayName === 'string' ? data.displayName : null,
        role: safeString(data.role) || 'user',
      };
    })
    .sort((a, b) => (a.displayName || a.email || a.id).localeCompare(b.displayName || b.email || b.id));

  const projects = projectsSnapshot.docs
    .map((snapshot) => {
      const data = snapshot.data();
      const budgetCapKobo = Math.round(safeNumber(data.budgetCapKobo));
      return {
        id: snapshot.id,
        ownerId: safeString(data.ownerId),
        name: safeString(data.name) || 'Untitled Project',
        code: safeString(data.code),
        stage: safeString(data.stage),
        status: safeString(data.status) || 'Inactive',
        location: safeString(data.location),
        budgetCapKobo,
        budgetCap: fromKobo(budgetCapKobo),
        createdAt: safeString(data.createdAt),
        updatedAt: safeString(data.updatedAt),
      };
    })
    .sort((a, b) => {
      const aTime = Date.parse(a.updatedAt || a.createdAt || '') || 0;
      const bTime = Date.parse(b.updatedAt || b.createdAt || '') || 0;
      return bTime - aTime;
    });

  const auditEvents = auditSnapshot.docs
    .map((snapshot) => {
      const data = snapshot.data();
      return {
        id: snapshot.id,
        projectId: safeString(data.projectId),
        ownerId: safeString(data.ownerId),
        timestamp: safeString(data.timestamp),
        user: safeString(data.user),
        userEmail: safeString(data.userEmail),
        action: safeString(data.action),
        entity: safeString(data.entity),
        entityId: safeString(data.entityId),
        summary: safeString(data.summary),
      };
    })
    .sort((a, b) => {
      const aTime = Date.parse(a.timestamp) || 0;
      const bTime = Date.parse(b.timestamp) || 0;
      return bTime - aTime;
    });

  return {
    users,
    projects,
    auditEvents,
  };
}
