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
import type { DocumentReference, WriteBatch } from 'firebase/firestore';
import { db } from '../firebase';

export interface AdminMaterialRecord {
  id: string;
  projectId: string;
  name: string;
  category: string;
  unit: string;
  totalPurchased: number;
  totalUsed: number;
  remaining: number;
  lowStockThreshold: number;
  totalCostKobo: number;
  purchaseCount: number;
  usageCount: number;
}

const QUERY_LIMIT = 500;
const BATCH_SIZE = 400;
const RULE_SAFE_BATCH_SIZE = 10;

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function koboValue(data: Record<string, unknown>, koboKey: string, nairaKey: string): number {
  const kobo = data[koboKey];
  if (typeof kobo === 'number' && Number.isFinite(kobo)) return Math.round(kobo);
  const naira = data[nairaKey];
  return typeof naira === 'number' && Number.isFinite(naira) ? Math.round(naira * 100) : 0;
}

async function commitDeletes(refs: DocumentReference[]): Promise<void> {
  for (let index = 0; index < refs.length; index += BATCH_SIZE) {
    const batch = writeBatch(db);
    refs.slice(index, index + BATCH_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function commitSmallBatches(
  refs: DocumentReference[],
  write: (batch: WriteBatch, ref: DocumentReference, index: number) => void,
): Promise<void> {
  for (let index = 0; index < refs.length; index += RULE_SAFE_BATCH_SIZE) {
    const batch = writeBatch(db);
    refs
      .slice(index, index + RULE_SAFE_BATCH_SIZE)
      .forEach((ref, offset) => write(batch, ref, index + offset));
    await batch.commit();
  }
}

export async function loadAdminProjectMaterials(projectId: string): Promise<AdminMaterialRecord[]> {
  const [materialsSnapshot, purchasesSnapshot, usageSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'materials'), where('projectId', '==', projectId), limit(QUERY_LIMIT))),
    getDocs(query(collection(db, 'purchases'), where('projectId', '==', projectId), limit(QUERY_LIMIT))),
    getDocs(query(collection(db, 'materialUsage'), where('projectId', '==', projectId), limit(QUERY_LIMIT))),
  ]);

  const purchaseCounts = new Map<string, number>();
  purchasesSnapshot.docs.forEach((snapshot) => {
    const data = snapshot.data();
    const materialId = typeof data.materialId === 'string' ? data.materialId : '';
    if (materialId) purchaseCounts.set(materialId, (purchaseCounts.get(materialId) || 0) + 1);
  });

  const usageCounts = new Map<string, number>();
  usageSnapshot.docs.forEach((snapshot) => {
    const data = snapshot.data();
    const materialId = typeof data.materialId === 'string' ? data.materialId : '';
    if (materialId) usageCounts.set(materialId, (usageCounts.get(materialId) || 0) + 1);
  });

  return materialsSnapshot.docs
    .map((snapshot) => {
      const data = snapshot.data() as Record<string, unknown>;
      return {
        id: snapshot.id,
        projectId,
        name: typeof data.name === 'string' ? data.name : 'Unnamed material',
        category: typeof data.category === 'string' ? data.category : 'Other',
        unit: typeof data.unit === 'string' ? data.unit : '',
        totalPurchased: numberValue(data.totalPurchased),
        totalUsed: numberValue(data.totalUsed),
        remaining: numberValue(data.remaining),
        lowStockThreshold: numberValue(data.lowStockThreshold),
        totalCostKobo: koboValue(data, 'totalCostKobo', 'totalCost'),
        purchaseCount: purchaseCounts.get(snapshot.id) || 0,
        usageCount: usageCounts.get(snapshot.id) || 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function deleteAdminMaterial(
  projectId: string,
  materialId: string,
  adminUid: string,
  adminEmail?: string | null,
): Promise<{ deletedPurchases: number; deletedUsage: number; deletedTransport: number }> {
  if (!adminUid) throw new Error('Administrator authentication is required.');

  const [projectSnapshot, materialSnapshot] = await Promise.all([
    getDoc(doc(db, 'projects', projectId)),
    getDoc(doc(db, 'materials', materialId)),
  ]);

  if (!projectSnapshot.exists() || typeof projectSnapshot.data()?.ownerId !== 'string') {
    throw new Error('Project could not be verified.');
  }
  if (!materialSnapshot.exists()) {
    throw new Error('Material could not be found.');
  }

  const project = projectSnapshot.data();
  const material = materialSnapshot.data();

  if (material.projectId !== projectId || material.ownerId !== project.ownerId) {
    throw new Error('Material does not belong to the selected project.');
  }

  const [purchasesSnapshot, usageSnapshot, transportationSnapshot] = await Promise.all([
    getDocs(query(
      collection(db, 'purchases'),
      where('projectId', '==', projectId),
      where('materialId', '==', materialId),
      limit(QUERY_LIMIT),
    )),
    getDocs(query(
      collection(db, 'materialUsage'),
      where('projectId', '==', projectId),
      where('materialId', '==', materialId),
      limit(QUERY_LIMIT),
    )),
    getDocs(query(
      collection(db, 'transportation'),
      where('projectId', '==', projectId),
      limit(QUERY_LIMIT),
    )),
  ]);

  if (
    purchasesSnapshot.size >= QUERY_LIMIT ||
    usageSnapshot.size >= QUERY_LIMIT ||
    transportationSnapshot.size >= QUERY_LIMIT
  ) {
    throw new Error('This material has more than 500 linked records or the project has more than 500 transport records. Use the larger-scale administrative deletion workflow instead of this client-side purge.');
  }

  const purchaseIds = purchasesSnapshot.docs.map((snapshot) => snapshot.id);
  const purchaseIdSet = new Set(purchaseIds);
  const transportationRefs = transportationSnapshot.docs
    .filter((snapshot) => {
      const purchaseId = snapshot.data().purchaseId;
      return typeof purchaseId === 'string' && purchaseIdSet.has(purchaseId);
    })
    .map((snapshot) => snapshot.ref);

  const transportPurchaseIds = Array.from(
    new Set(
      transportationSnapshot.docs
        .map((snapshot) => snapshot.data().purchaseId)
        .filter(
          (purchaseId): purchaseId is string =>
            typeof purchaseId === 'string' && purchaseIdSet.has(purchaseId),
        ),
    ),
  );

  const intentId = `${projectId}__${materialId}`;
  const intentRef = doc(db, 'adminMaterialDeletionIntents', intentId);
  const purchaseIntentRefs = transportPurchaseIds.map((purchaseId) =>
    doc(db, 'adminPurchaseDeletionIntents', purchaseId),
  );

  await setDoc(intentRef, {
    entityType: 'AdminMaterialDeletionIntent',
    projectId,
    materialId,
    ownerId: project.ownerId,
    adminUid,
    purchaseIds,
    createdAt: new Date().toISOString(),
  });

  try {
    await commitSmallBatches(purchaseIntentRefs, (batch, ref, index) => {
      const purchaseId = transportPurchaseIds[index];
      batch.set(ref, {
        entityType: 'AdminPurchaseDeletionIntent',
        projectId,
        materialId,
        purchaseId,
        ownerId: project.ownerId,
        adminUid,
        createdAt: new Date().toISOString(),
      });
    });

    await commitDeletes([
      ...purchasesSnapshot.docs.map((snapshot) => snapshot.ref),
      ...usageSnapshot.docs.map((snapshot) => snapshot.ref),
      materialSnapshot.ref,
    ]);

    await commitSmallBatches(transportationRefs, (batch, ref) => {
      batch.delete(ref);
    });

    const auditRef = doc(collection(db, 'auditEvents'));
    await setDoc(auditRef, {
      projectId,
      ownerId: project.ownerId,
      timestamp: new Date().toISOString(),
      user: adminUid,
      userEmail: adminEmail || 'Administrator',
      action: 'DELETE',
      entity: 'Material',
      entityType: 'Material',
      entityId: materialId,
      summary: `Administrator removed material “${material.name || materialId}” and linked transaction history`,
      details: JSON.stringify({
        materialId,
        materialName: material.name || materialId,
        deletedPurchases: purchasesSnapshot.size,
        deletedUsage: usageSnapshot.size,
        deletedTransportation: transportationRefs.length,
      }),
    });

    return {
      deletedPurchases: purchasesSnapshot.size,
      deletedUsage: usageSnapshot.size,
      deletedTransport: transportationRefs.length,
    };
  } finally {
    await deleteDoc(intentRef).catch(() => undefined);
    await commitDeletes(purchaseIntentRefs).catch(() => undefined);
  }
}
