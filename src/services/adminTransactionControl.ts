import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

const QUERY_LIMIT = 500;
const RULE_SAFE_TRANSPORT_BATCH_SIZE = 4;

export type AdminTransactionEntity =
  | 'Purchase'
  | 'MaterialUsage'
  | 'LabourPayment'
  | 'Transportation'
  | 'OtherExpense'
  | 'WorkProgress';

export interface AdminTransactionRecord {
  id: string;
  projectId: string;
  entityType: AdminTransactionEntity;
  title: string;
  subtitle: string;
  amountKobo: number;
  date: string;
  materialId?: string;
  contractorId?: string;
  purchaseId?: string;
  linkedCount?: number;
}

export interface AdminTransactionRegister {
  purchases: AdminTransactionRecord[];
  usage: AdminTransactionRecord[];
  labourPayments: AdminTransactionRecord[];
  transportation: AdminTransactionRecord[];
  otherExpenses: AdminTransactionRecord[];
  workProgress: AdminTransactionRecord[];
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function koboValue(data: Record<string, unknown>, koboKey: string, nairaKey: string): number {
  const kobo = data[koboKey];
  if (typeof kobo === 'number' && Number.isFinite(kobo)) return Math.round(kobo);
  const naira = data[nairaKey];
  return typeof naira === 'number' && Number.isFinite(naira) ? Math.round(naira * 100) : 0;
}

function dateValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asRecord(snapshot: { data: () => Record<string, unknown> }): Record<string, unknown> {
  return snapshot.data();
}

async function loadCollection(projectId: string, collectionName: string) {
  return getDocs(query(
    collection(db, collectionName),
    where('projectId', '==', projectId),
    limit(QUERY_LIMIT),
  ));
}

export async function loadAdminProjectTransactions(projectId: string): Promise<AdminTransactionRegister> {
  const [
    purchasesSnapshot,
    usageSnapshot,
    labourPaymentsSnapshot,
    transportationSnapshot,
    otherExpensesSnapshot,
    workProgressSnapshot,
  ] = await Promise.all([
    loadCollection(projectId, 'purchases'),
    loadCollection(projectId, 'materialUsage'),
    loadCollection(projectId, 'labourPayments'),
    loadCollection(projectId, 'transportation'),
    loadCollection(projectId, 'otherExpenses'),
    loadCollection(projectId, 'workProgress'),
  ]);

  const transportByPurchase = new Map<string, number>();
  transportationSnapshot.docs.forEach((snapshot) => {
    const purchaseId = snapshot.data().purchaseId;
    if (typeof purchaseId === 'string') {
      transportByPurchase.set(purchaseId, (transportByPurchase.get(purchaseId) || 0) + 1);
    }
  });

  const purchases = purchasesSnapshot.docs.map((snapshot) => {
    const data = asRecord(snapshot);
    const materialName = typeof data.materialName === 'string' ? data.materialName : 'Purchase';
    return {
      id: snapshot.id,
      projectId,
      entityType: 'Purchase' as const,
      title: materialName,
      subtitle: `${numberValue(data.quantity)} ${typeof data.unit === 'string' ? data.unit : ''} • ${typeof data.supplier === 'string' ? data.supplier : 'Supplier not recorded'}`,
      amountKobo: koboValue(data, 'acquisitionCostKobo', 'acquisitionCost'),
      date: dateValue(data.purchaseDate || data.createdAt),
      materialId: typeof data.materialId === 'string' ? data.materialId : undefined,
      linkedCount: transportByPurchase.get(snapshot.id) || 0,
    };
  });

  const usage = usageSnapshot.docs.map((snapshot) => {
    const data = asRecord(snapshot);
    return {
      id: snapshot.id,
      projectId,
      entityType: 'MaterialUsage' as const,
      title: typeof data.materialName === 'string' ? data.materialName : 'Material usage',
      subtitle: `${numberValue(data.quantityUsed)} ${typeof data.unit === 'string' ? data.unit : ''} • ${typeof data.workArea === 'string' ? data.workArea : 'Work area not recorded'}`,
      amountKobo: 0,
      date: dateValue(data.date || data.createdAt),
      materialId: typeof data.materialId === 'string' ? data.materialId : undefined,
    };
  });

  const labourPayments = labourPaymentsSnapshot.docs.map((snapshot) => {
    const data = asRecord(snapshot);
    return {
      id: snapshot.id,
      projectId,
      entityType: 'LabourPayment' as const,
      title: typeof data.contractorName === 'string' ? data.contractorName : 'Labour payment',
      subtitle: typeof data.milestoneTitle === 'string' ? data.milestoneTitle : 'Milestone not recorded',
      amountKobo: koboValue(data, 'amountKobo', 'amount'),
      date: dateValue(data.paymentDate || data.createdAt),
      contractorId: typeof data.contractorId === 'string' ? data.contractorId : undefined,
    };
  });

  const transportation = transportationSnapshot.docs.map((snapshot) => {
    const data = asRecord(snapshot);
    return {
      id: snapshot.id,
      projectId,
      entityType: 'Transportation' as const,
      title: typeof data.itemTransported === 'string' ? data.itemTransported : 'Transportation',
      subtitle: `${typeof data.from === 'string' ? data.from : 'Origin'} → ${typeof data.to === 'string' ? data.to : 'Destination'}`,
      amountKobo: koboValue(data, 'costKobo', 'cost'),
      date: dateValue(data.date || data.createdAt),
      purchaseId: typeof data.purchaseId === 'string' ? data.purchaseId : undefined,
    };
  });

  const otherExpenses = otherExpensesSnapshot.docs.map((snapshot) => {
    const data = asRecord(snapshot);
    return {
      id: snapshot.id,
      projectId,
      entityType: 'OtherExpense' as const,
      title: typeof data.description === 'string' ? data.description : 'Other expense',
      subtitle: typeof data.category === 'string' ? data.category : 'Expense',
      amountKobo: koboValue(data, 'amountKobo', 'amount'),
      date: dateValue(data.date || data.createdAt),
    };
  });

  const workProgress = workProgressSnapshot.docs.map((snapshot) => {
    const data = asRecord(snapshot);
    return {
      id: snapshot.id,
      projectId,
      entityType: 'WorkProgress' as const,
      title: typeof data.name === 'string' ? data.name : 'Work stream',
      subtitle: `${numberValue(data.completionPercent)}% complete • ${typeof data.status === 'string' ? data.status : 'Status not recorded'}`,
      amountKobo: koboValue(data, 'actualPaidKobo', 'actualPaid'),
      date: dateValue(data.updatedAt || data.createdAt),
    };
  });

  const byDateDesc = (a: AdminTransactionRecord, b: AdminTransactionRecord) =>
    new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();

  purchases.sort(byDateDesc);
  usage.sort(byDateDesc);
  labourPayments.sort(byDateDesc);
  transportation.sort(byDateDesc);
  otherExpenses.sort(byDateDesc);
  workProgress.sort(byDateDesc);

  return { purchases, usage, labourPayments, transportation, otherExpenses, workProgress };
}

async function verifyProject(projectId: string) {
  const snapshot = await getDoc(doc(db, 'projects', projectId));
  if (!snapshot.exists()) throw new Error('Project could not be verified.');
  const data = snapshot.data();
  if (typeof data.ownerId !== 'string') throw new Error('Project owner could not be verified.');
  return { snapshot, data };
}

async function createIntent(
  entityType: AdminTransactionEntity,
  entityId: string,
  projectId: string,
  ownerId: string,
  adminUid: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await setDoc(doc(db, 'adminTransactionDeletionIntents', entityId), {
    entityType,
    entityId,
    projectId,
    ownerId,
    adminUid,
    createdAt: new Date().toISOString(),
    ...extra,
  });
}

async function deleteIntent(entityType: AdminTransactionEntity, entityId: string): Promise<void> {
  await deleteDoc(doc(db, 'adminTransactionDeletionIntents', entityId)).catch(() => undefined);
}

async function commitRuleSafeDeletes(refs: ReturnType<typeof doc>[]): Promise<void> {
  for (let index = 0; index < refs.length; index += RULE_SAFE_TRANSPORT_BATCH_SIZE) {
    const batch = writeBatch(db);
    refs
      .slice(index, index + RULE_SAFE_TRANSPORT_BATCH_SIZE)
      .forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function createReconciliationIntent(
  kind: 'material' | 'contractor',
  id: string,
  projectId: string,
  ownerId: string,
  adminUid: string,
): Promise<string> {
  const intentId = id;
  await setDoc(doc(db, 'adminTransactionDeletionIntents', intentId), {
    entityType: kind === 'material' ? 'MaterialReconciliation' : 'ContractorReconciliation',
    entityId: intentId,
    projectId,
    ownerId,
    adminUid,
    ...(kind === 'material'
      ? { reconciliationMaterialId: id }
      : { reconciliationContractorId: id }),
    createdAt: new Date().toISOString(),
  });
  return intentId;
}

async function deleteReconciliationIntent(intentId: string): Promise<void> {
  await deleteDoc(doc(db, 'adminTransactionDeletionIntents', intentId)).catch(() => undefined);
}

async function writeAudit(
  batch: ReturnType<typeof writeBatch>,
  projectId: string,
  ownerId: string,
  adminUid: string,
  adminEmail: string | null | undefined,
  entity: string,
  entityId: string,
  summary: string,
  details: Record<string, unknown>,
): Promise<void> {
  const auditRef = doc(collection(db, 'auditEvents'));
  batch.set(auditRef, {
    projectId,
    ownerId,
    timestamp: new Date().toISOString(),
    user: adminUid,
    userEmail: adminEmail || 'Administrator',
    action: 'DELETE',
    entity,
    entityType: entity,
    entityId,
    summary,
    details: JSON.stringify(details),
  });
}

async function reconcileMaterial(
  batch: ReturnType<typeof writeBatch>,
  projectId: string,
  materialId: string,
): Promise<void> {
  const materialRef = doc(db, 'materials', materialId);
  const materialSnapshot = await getDoc(materialRef);
  if (!materialSnapshot.exists()) return;
  const material = materialSnapshot.data();

  const [purchasesSnapshot, usageSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'purchases'), where('projectId', '==', projectId), where('materialId', '==', materialId), limit(QUERY_LIMIT))),
    getDocs(query(collection(db, 'materialUsage'), where('projectId', '==', projectId), where('materialId', '==', materialId), limit(QUERY_LIMIT))),
  ]);

  const totalPurchased = purchasesSnapshot.docs.reduce((sum, snapshot) => sum + numberValue(snapshot.data().quantity), 0);
  const totalUsed = usageSnapshot.docs.reduce((sum, snapshot) => sum + numberValue(snapshot.data().quantityUsed), 0);
  const totalMaterialCostKobo = purchasesSnapshot.docs.reduce(
    (sum, snapshot) => sum + koboValue(snapshot.data(), 'materialCostKobo', 'materialCost'),
    0,
  );
  const avgUnitPriceKobo = totalPurchased > 0
    ? Math.round(totalMaterialCostKobo / totalPurchased)
    : numberValue(material.avgUnitPriceKobo);

  batch.set(materialRef, {
    ...material,
    projectId,
    ownerId: material.ownerId,
    totalPurchased,
    totalUsed,
    remaining: Math.max(0, totalPurchased - totalUsed),
    avgUnitPriceKobo,
    unitPriceKobo: avgUnitPriceKobo,
    totalCostKobo: totalMaterialCostKobo,
    avgUnitPrice: avgUnitPriceKobo / 100,
    totalCost: totalMaterialCostKobo / 100,
    updatedAt: new Date().toISOString(),
  });
}

async function reconcileContractor(
  batch: ReturnType<typeof writeBatch>,
  projectId: string,
  contractorId: string,
): Promise<void> {
  const contractorRef = doc(db, 'contractors', contractorId);
  const contractorSnapshot = await getDoc(contractorRef);
  if (!contractorSnapshot.exists()) return;
  const contractor = contractorSnapshot.data();

  const paymentsSnapshot = await getDocs(query(
    collection(db, 'labourPayments'),
    where('projectId', '==', projectId),
    where('contractorId', '==', contractorId),
    limit(QUERY_LIMIT),
  ));

  const totalPaidKobo = paymentsSnapshot.docs.reduce(
    (sum, snapshot) => sum + koboValue(snapshot.data(), 'amountKobo', 'amount'),
    0,
  );
  const agreedAmountKobo = numberValue(contractor.agreedAmountKobo) || Math.round(numberValue(contractor.agreedAmount) * 100);
  const outstandingBalanceKobo = Math.max(0, agreedAmountKobo - totalPaidKobo);
  const overpaymentKobo = Math.max(0, totalPaidKobo - agreedAmountKobo);

  batch.set(contractorRef, {
    ...contractor,
    projectId,
    ownerId: contractor.ownerId,
    agreedAmountKobo,
    totalPaidKobo,
    outstandingBalanceKobo,
    overpaymentKobo,
    agreedAmount: agreedAmountKobo / 100,
    totalPaid: totalPaidKobo / 100,
    outstandingBalance: outstandingBalanceKobo / 100,
    overpayment: overpaymentKobo / 100,
    updatedAt: new Date().toISOString(),
  });
}

async function deleteWithAudit(
  entityType: AdminTransactionEntity,
  entityId: string,
  projectId: string,
  adminUid: string,
  adminEmail: string | null | undefined,
  title: string,
  amountKobo: number,
  refsToDelete: ReturnType<typeof doc>[],
  summary: string,
  details: Record<string, unknown>,
  reconciliation?: { kind: 'material' | 'contractor'; id: string },
): Promise<void> {
  const { data: project } = await verifyProject(projectId);
  const ownerId = project.ownerId;

  await createIntent(entityType, entityId, projectId, ownerId, adminUid, reconciliation
    ? reconciliation.kind === 'material'
      ? { reconciliationMaterialId: reconciliation.id }
      : { reconciliationContractorId: reconciliation.id }
    : {});

  let reconciliationIntentId: string | null = null;
  try {
    if (reconciliation) {
      reconciliationIntentId = await createReconciliationIntent(
        reconciliation.kind,
        reconciliation.id,
        projectId,
        ownerId,
        adminUid,
      );
    }

    const batch = writeBatch(db);
    refsToDelete.forEach((ref) => batch.delete(ref));

    if (reconciliation?.kind === 'material') {
      await reconcileMaterial(batch, projectId, reconciliation.id);
    } else if (reconciliation?.kind === 'contractor') {
      await reconcileContractor(batch, projectId, reconciliation.id);
    }

    await writeAudit(batch, projectId, ownerId, adminUid, adminEmail, entityType, entityId, summary, {
      ...details,
      amountKobo,
      title,
    });

    await batch.commit();
  } finally {
    if (reconciliationIntentId) await deleteReconciliationIntent(reconciliationIntentId);
    await deleteIntent(entityType, entityId);
  }
}

export async function deleteAdminPurchase(
  projectId: string,
  purchaseId: string,
  adminUid: string,
  adminEmail?: string | null,
): Promise<{ deletedTransport: number }> {
  const { data: project } = await verifyProject(projectId);
  const purchaseRef = doc(db, 'purchases', purchaseId);
  const purchaseSnapshot = await getDoc(purchaseRef);
  if (!purchaseSnapshot.exists()) throw new Error('Purchase could not be found.');
  const purchase = purchaseSnapshot.data();

  if (purchase.projectId !== projectId || purchase.ownerId !== project.ownerId) {
    throw new Error('Purchase does not belong to the selected project.');
  }

  const transportSnapshot = await getDocs(query(
    collection(db, 'transportation'),
    where('projectId', '==', projectId),
    where('purchaseId', '==', purchaseId),
    limit(QUERY_LIMIT),
  ));

  await createIntent('Purchase', purchaseId, projectId, project.ownerId, adminUid, {
    reconciliationMaterialId: typeof purchase.materialId === 'string' ? purchase.materialId : '',
  });

  const purchaseIntentRef = doc(db, 'adminPurchaseDeletionIntents', purchaseId);
  await setDoc(purchaseIntentRef, {
    entityType: 'AdminPurchaseDeletionIntent',
    projectId,
    materialId: typeof purchase.materialId === 'string' ? purchase.materialId : '',
    purchaseId,
    ownerId: project.ownerId,
    adminUid,
    createdAt: new Date().toISOString(),
  });

  let reconciliationIntentId: string | null = null;
  try {
    if (typeof purchase.materialId === 'string' && purchase.materialId) {
      reconciliationIntentId = await createReconciliationIntent(
        'material',
        purchase.materialId,
        projectId,
        project.ownerId,
        adminUid,
      );
    }

    await commitRuleSafeDeletes(transportSnapshot.docs.map((snapshot) => snapshot.ref));

    const batch = writeBatch(db);
    batch.delete(purchaseRef);

    if (typeof purchase.materialId === 'string' && purchase.materialId) {
      await reconcileMaterial(batch, projectId, purchase.materialId);
    }

    await writeAudit(
      batch,
      projectId,
      project.ownerId,
      adminUid,
      adminEmail,
      'Purchase',
      purchaseId,
      `Administrator removed purchase “${purchase.materialName || purchaseId}” and linked transport history`,
      {
        purchaseId,
        materialId: purchase.materialId || null,
        deletedTransportation: transportSnapshot.size,
        acquisitionCostKobo: koboValue(purchase, 'acquisitionCostKobo', 'acquisitionCost'),
      },
    );

    await batch.commit();
    return { deletedTransport: transportSnapshot.size };
  } finally {
    if (reconciliationIntentId) await deleteReconciliationIntent(reconciliationIntentId);
    await deleteIntent('Purchase', purchaseId);
    await deleteDoc(purchaseIntentRef).catch(() => undefined);
  }
}

export async function deleteAdminMaterialUsage(
  projectId: string,
  usageId: string,
  adminUid: string,
  adminEmail?: string | null,
): Promise<void> {
  const { data: project } = await verifyProject(projectId);
  const usageRef = doc(db, 'materialUsage', usageId);
  const usageSnapshot = await getDoc(usageRef);
  if (!usageSnapshot.exists()) throw new Error('Material usage record could not be found.');
  const usage = usageSnapshot.data();

  if (usage.projectId !== projectId || usage.ownerId !== project.ownerId) {
    throw new Error('Material usage record does not belong to the selected project.');
  }
  if (typeof usage.materialId !== 'string' || !usage.materialId) {
    throw new Error('Material usage record has no valid material reference.');
  }

  await deleteWithAudit(
    'MaterialUsage',
    usageId,
    projectId,
    adminUid,
    adminEmail,
    usage.materialName || usageId,
    0,
    [usageRef],
    `Administrator removed material usage “${usage.materialName || usageId}”`,
    { usageId, materialId: usage.materialId, quantityUsed: numberValue(usage.quantityUsed) },
    { kind: 'material', id: usage.materialId },
  );
}

export async function deleteAdminLabourPayment(
  projectId: string,
  paymentId: string,
  adminUid: string,
  adminEmail?: string | null,
): Promise<void> {
  const { data: project } = await verifyProject(projectId);
  const paymentRef = doc(db, 'labourPayments', paymentId);
  const paymentSnapshot = await getDoc(paymentRef);
  if (!paymentSnapshot.exists()) throw new Error('Labour payment could not be found.');
  const payment = paymentSnapshot.data();

  if (payment.projectId !== projectId || payment.ownerId !== project.ownerId) {
    throw new Error('Labour payment does not belong to the selected project.');
  }
  if (typeof payment.contractorId !== 'string' || !payment.contractorId) {
    throw new Error('Labour payment has no valid contractor reference.');
  }

  await deleteWithAudit(
    'LabourPayment',
    paymentId,
    projectId,
    adminUid,
    adminEmail,
    payment.contractorName || paymentId,
    koboValue(payment, 'amountKobo', 'amount'),
    [paymentRef],
    `Administrator removed labour payment to “${payment.contractorName || paymentId}”`,
    { paymentId, contractorId: payment.contractorId, milestoneTitle: payment.milestoneTitle || '' },
    { kind: 'contractor', id: payment.contractorId },
  );
}

export async function deleteAdminTransportation(
  projectId: string,
  transportId: string,
  adminUid: string,
  adminEmail?: string | null,
): Promise<void> {
  const { data: project } = await verifyProject(projectId);
  const transportRef = doc(db, 'transportation', transportId);
  const transportSnapshot = await getDoc(transportRef);
  if (!transportSnapshot.exists()) throw new Error('Transportation record could not be found.');
  const transport = transportSnapshot.data();

  if (transport.projectId !== projectId || transport.ownerId !== project.ownerId) {
    throw new Error('Transportation record does not belong to the selected project.');
  }

  await deleteWithAudit(
    'Transportation',
    transportId,
    projectId,
    adminUid,
    adminEmail,
    transport.itemTransported || transportId,
    koboValue(transport, 'costKobo', 'cost'),
    [transportRef],
    `Administrator removed transportation record “${transport.itemTransported || transportId}”`,
    { transportId, purchaseId: transport.purchaseId || null },
  );
}

export async function deleteAdminOtherExpense(
  projectId: string,
  expenseId: string,
  adminUid: string,
  adminEmail?: string | null,
): Promise<void> {
  const { data: project } = await verifyProject(projectId);
  const expenseRef = doc(db, 'otherExpenses', expenseId);
  const expenseSnapshot = await getDoc(expenseRef);
  if (!expenseSnapshot.exists()) throw new Error('Other expense record could not be found.');
  const expense = expenseSnapshot.data();

  if (expense.projectId !== projectId || expense.ownerId !== project.ownerId) {
    throw new Error('Other expense does not belong to the selected project.');
  }

  await deleteWithAudit(
    'OtherExpense',
    expenseId,
    projectId,
    adminUid,
    adminEmail,
    expense.description || expenseId,
    koboValue(expense, 'amountKobo', 'amount'),
    [expenseRef],
    `Administrator removed other expense “${expense.description || expenseId}”`,
    { expenseId, category: expense.category || '' },
  );
}

export async function deleteAdminWorkProgress(
  projectId: string,
  progressId: string,
  adminUid: string,
  adminEmail?: string | null,
): Promise<void> {
  const { data: project } = await verifyProject(projectId);
  const progressRef = doc(db, 'workProgress', progressId);
  const progressSnapshot = await getDoc(progressRef);
  if (!progressSnapshot.exists()) throw new Error('Work progress record could not be found.');
  const progress = progressSnapshot.data();

  if (progress.projectId !== projectId || progress.ownerId !== project.ownerId) {
    throw new Error('Work progress record does not belong to the selected project.');
  }

  await deleteWithAudit(
    'WorkProgress',
    progressId,
    projectId,
    adminUid,
    adminEmail,
    progress.name || progressId,
    koboValue(progress, 'actualPaidKobo', 'actualPaid'),
    [progressRef],
    `Administrator removed work stream “${progress.name || progressId}”`,
    { progressId, completionPercent: numberValue(progress.completionPercent) },
  );
}
