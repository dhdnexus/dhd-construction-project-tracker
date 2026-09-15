import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
} from 'firebase/firestore';
import {
  db,
  auth,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  User,
} from '../firebase';
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
  AuditEvent,
  AggregatedMetrics,
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
import {
  calculatePurchaseTotals,
  calculateLabourBalances,
  toKobo,
  fromKobo,
} from '../utils/formatters';

export const STORAGE_UPDATE_EVENT = 'dhd_storage_update';

// Cache keys for offline/instant initial boot
const CACHE_KEYS = {
  PROJECT: 'dhd_cache_project',
  MATERIALS: 'dhd_cache_materials',
  PURCHASES: 'dhd_cache_purchases',
  USAGE: 'dhd_cache_usage',
  WORK_PROGRESS: 'dhd_cache_work_progress',
  CONTRACTORS: 'dhd_cache_contractors',
  LABOUR_PAYMENTS: 'dhd_cache_labour_payments',
  TRANSPORTATION: 'dhd_cache_transportation',
  OTHER_EXPENSES: 'dhd_cache_other_expenses',
  CATEGORY_BUDGETS: 'dhd_cache_category_budgets',
  AUDIT_EVENTS: 'dhd_cache_audit_events',
};

function readLocalCache<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw === 'undefined' || raw === 'null') return fallback;
    const parsed = JSON.parse(raw);
    return parsed !== null && parsed !== undefined ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalCache<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Local cache write failed for ${key}:`, err);
  }
}

export class ConstructionTrackerService {
  private static currentUser: User | null = null;
  private static isInitialized = false;
  private static unsubscribeListeners: (() => void)[] = [];

  // In-memory data store for synchronous rendering
  private static cachedProject: ProjectSettings = readLocalCache(CACHE_KEYS.PROJECT, initialProject);
  private static cachedMaterials: Material[] = readLocalCache(CACHE_KEYS.MATERIALS, initialMaterials);
  private static cachedPurchases: PurchaseRecord[] = readLocalCache(CACHE_KEYS.PURCHASES, initialPurchases);
  private static cachedUsage: MaterialUsage[] = readLocalCache(CACHE_KEYS.USAGE, initialUsage);
  private static cachedWorkProgress: WorkProgressItem[] = readLocalCache(CACHE_KEYS.WORK_PROGRESS, initialWorkProgress);
  private static cachedContractors: Contractor[] = readLocalCache(CACHE_KEYS.CONTRACTORS, initialContractors);
  private static cachedLabourPayments: LabourPayment[] = readLocalCache(CACHE_KEYS.LABOUR_PAYMENTS, initialLabourPayments);
  private static cachedTransportation: TransportationRecord[] = readLocalCache(CACHE_KEYS.TRANSPORTATION, initialTransportation);
  private static cachedOtherExpenses: OtherExpenseRecord[] = readLocalCache(CACHE_KEYS.OTHER_EXPENSES, initialOtherExpenses);
  private static cachedCategoryBudgets: Record<string, number> = readLocalCache(CACHE_KEYS.CATEGORY_BUDGETS, {
    Materials: 15000000,
    Labour: 6500000,
    Transportation: 1500000,
    'Other Expenses': 4000000,
  });
  private static cachedAuditEvents: AuditEvent[] = readLocalCache(CACHE_KEYS.AUDIT_EVENTS, []);

  public static notify(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(STORAGE_UPDATE_EVENT));
    }
  }

  public static getOwnerId(): string {
    return this.currentUser?.uid || 'anonymous_user';
  }

  public static getProjectId(): string {
    return this.cachedProject.id || 'proj_default';
  }

  public static getUserEmail(): string {
    return this.currentUser?.email || (this.currentUser?.isAnonymous ? 'Anonymous Engineer' : 'Site User');
  }

  /**
   * Initializes Firebase Auth listener and binds Firestore real-time snapshots
   */
  public static initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.currentUser = user;
        this.setupFirestoreSubscriptions(user.uid);
      } else {
        // Sign in anonymously so preview & usage works immediately with real Firestore security
        try {
          const cred = await signInAnonymously(auth);
          this.currentUser = cred.user;
          this.setupFirestoreSubscriptions(cred.user.uid);
        } catch (err) {
          console.warn('Anonymous sign-in fallback triggered:', err);
          // Still listen or use local state
        }
      }
      this.notify();
    });
  }

  /**
   * Setup real-time Firestore collection listeners scoped by ownerId
   */
  private static setupFirestoreSubscriptions(ownerId: string): void {
    // Clear old listeners
    this.unsubscribeListeners.forEach((unsub) => unsub());
    this.unsubscribeListeners = [];

    const bindCollection = <T extends { id: string }>(
      colName: string,
      cacheKey: string,
      setter: (items: T[]) => void,
      onEmptySeed?: () => void
    ) => {
      try {
        const q = query(collection(db, colName), where('ownerId', '==', ownerId));
        const unsub = onSnapshot(
          q,
          (snapshot) => {
            if (snapshot.empty && onEmptySeed) {
              onEmptySeed();
              return;
            }
            const docs: T[] = [];
            snapshot.forEach((d) => {
              docs.push(d.data() as T);
            });
            setter(docs);
            writeLocalCache(cacheKey, docs);
            this.notify();
          },
          (err) => {
            console.warn(`Firestore subscription error on ${colName}:`, err);
          }
        );
        this.unsubscribeListeners.push(unsub);
      } catch (err) {
        console.warn(`Error attaching listener to ${colName}:`, err);
      }
    };

    // 1. Projects
    try {
      const projQ = query(collection(db, 'projects'), where('ownerId', '==', ownerId), limit(1));
      const unsubProj = onSnapshot(
        projQ,
        (snapshot) => {
          if (snapshot.empty) {
            // First time this user signs in: Seed initial project
            this.seedUserDataToFirestore(ownerId);
            return;
          }
          const docData = snapshot.docs[0].data() as ProjectSettings;
          this.cachedProject = { ...initialProject, ...docData };
          writeLocalCache(CACHE_KEYS.PROJECT, this.cachedProject);
          this.notify();
        },
        (err) => console.warn('Project listener error:', err)
      );
      this.unsubscribeListeners.push(unsubProj);
    } catch (e) {
      console.warn('Project subscription failed:', e);
    }

    // 2. Materials
    bindCollection<Material>('materials', CACHE_KEYS.MATERIALS, (items) => {
      this.cachedMaterials = items;
    });

    // 3. Purchases
    bindCollection<PurchaseRecord>('purchases', CACHE_KEYS.PURCHASES, (items) => {
      this.cachedPurchases = items.sort(
        (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
      );
    });

    // 4. Material Usage
    bindCollection<MaterialUsage>('materialUsage', CACHE_KEYS.USAGE, (items) => {
      this.cachedUsage = items.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    });

    // 5. Work Progress
    bindCollection<WorkProgressItem>('workProgress', CACHE_KEYS.WORK_PROGRESS, (items) => {
      this.cachedWorkProgress = items;
    });

    // 6. Contractors
    bindCollection<Contractor>('contractors', CACHE_KEYS.CONTRACTORS, (items) => {
      this.cachedContractors = items;
    });

    // 7. Labour Payments
    bindCollection<LabourPayment>('labourPayments', CACHE_KEYS.LABOUR_PAYMENTS, (items) => {
      this.cachedLabourPayments = items.sort(
        (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
      );
    });

    // 8. Transportation
    bindCollection<TransportationRecord>('transportation', CACHE_KEYS.TRANSPORTATION, (items) => {
      this.cachedTransportation = items.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    });

    // 9. Other Expenses
    bindCollection<OtherExpenseRecord>('otherExpenses', CACHE_KEYS.OTHER_EXPENSES, (items) => {
      this.cachedOtherExpenses = items.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    });

    // 10. Audit Events
    try {
      const auditQ = query(collection(db, 'auditEvents'), where('ownerId', '==', ownerId), limit(50));
      const unsubAudit = onSnapshot(
        auditQ,
        (snapshot) => {
          const events: AuditEvent[] = [];
          snapshot.forEach((d) => events.push(d.data() as AuditEvent));
          events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          this.cachedAuditEvents = events;
          writeLocalCache(CACHE_KEYS.AUDIT_EVENTS, events);
          this.notify();
        },
        (err) => console.warn('Audit listener error:', err)
      );
      this.unsubscribeListeners.push(unsubAudit);
    } catch (e) {
      console.warn('Audit subscription failed:', e);
    }
  }

  /**
   * Automatically seed initial data to Firestore for a new user
   */
  private static async seedUserDataToFirestore(ownerId: string): Promise<void> {
    try {
      const batch = writeBatch(db);
      const projectId = `proj_${ownerId.slice(0, 8)}`;

      // Project
      const projRef = doc(db, 'projects', projectId);
      const newProj: ProjectSettings = {
        ...initialProject,
        id: projectId,
        ownerId,
      };
      batch.set(projRef, newProj);

      // Materials
      initialMaterials.forEach((m) => {
        const ref = doc(db, 'materials', m.id);
        batch.set(ref, { ...m, projectId, ownerId });
      });

      // Purchases
      initialPurchases.forEach((p) => {
        const ref = doc(db, 'purchases', p.id);
        batch.set(ref, { ...p, projectId, ownerId });
      });

      // Usage
      initialUsage.forEach((u) => {
        const ref = doc(db, 'materialUsage', u.id);
        batch.set(ref, { ...u, projectId, ownerId });
      });

      // Work Progress
      initialWorkProgress.forEach((w) => {
        const ref = doc(db, 'workProgress', w.id);
        batch.set(ref, { ...w, projectId, ownerId });
      });

      // Contractors
      initialContractors.forEach((c) => {
        const ref = doc(db, 'contractors', c.id);
        batch.set(ref, { ...c, projectId, ownerId });
      });

      // Labour Payments
      initialLabourPayments.forEach((l) => {
        const ref = doc(db, 'labourPayments', l.id);
        batch.set(ref, { ...l, projectId, ownerId });
      });

      // Transportation
      initialTransportation.forEach((t) => {
        const ref = doc(db, 'transportation', t.id);
        batch.set(ref, { ...t, projectId, ownerId });
      });

      // Other Expenses
      initialOtherExpenses.forEach((e) => {
        const ref = doc(db, 'otherExpenses', e.id);
        batch.set(ref, { ...e, projectId, ownerId });
      });

      // Initial audit event
      const auditRef = doc(db, 'auditEvents', `audit_${Date.now()}`);
      batch.set(auditRef, {
        id: `audit_${Date.now()}`,
        projectId,
        ownerId,
        timestamp: new Date().toISOString(),
        user: this.getUserEmail(),
        action: 'CREATE',
        entity: 'System',
        entityId: projectId,
        summary: 'Initialized project with finishing phase seed records in Firestore',
      });

      await batch.commit();
    } catch (err) {
      console.warn('Error seeding user data to Firestore:', err);
    }
  }

  // ==================== AUDIT TRAIL ====================
  public static async recordAuditEvent(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESET' | 'RESTORE',
    entity: AuditEvent['entity'],
    entityId: string,
    summary: string
  ): Promise<void> {
    const ownerId = this.getOwnerId();
    const projectId = this.getProjectId();
    const newEvent: AuditEvent = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      projectId,
      ownerId,
      timestamp: new Date().toISOString(),
      user: this.getUserEmail(),
      action,
      entity,
      entityId,
      summary,
    };

    // Update in-memory cache
    this.cachedAuditEvents.unshift(newEvent);
    if (this.cachedAuditEvents.length > 50) this.cachedAuditEvents.pop();
    writeLocalCache(CACHE_KEYS.AUDIT_EVENTS, this.cachedAuditEvents);
    this.notify();

    // Async write to Firestore
    try {
      const ref = doc(db, 'auditEvents', newEvent.id);
      await setDoc(ref, newEvent);
    } catch (err) {
      console.warn('Failed to record audit event to Firestore:', err);
    }
  }

  public static getAuditEvents(): AuditEvent[] {
    return this.cachedAuditEvents;
  }

  // ==================== AUTH METHODS ====================
  public static getCurrentUser(): User | null {
    return this.currentUser;
  }

  public static async signIn(email: string, pass: string): Promise<void> {
    const res = await signInWithEmailAndPassword(auth, email, pass);
    this.currentUser = res.user;
    this.setupFirestoreSubscriptions(res.user.uid);
  }

  public static async signUp(email: string, pass: string, displayName?: string): Promise<void> {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    if (displayName && res.user) {
      await updateProfile(res.user, { displayName });
    }
    this.currentUser = res.user;
    this.setupFirestoreSubscriptions(res.user.uid);
  }

  public static async logout(): Promise<void> {
    await signOut(auth);
    this.currentUser = null;
    // Sign in anonymously to maintain seamless uninterrupted UI
    await signInAnonymously(auth);
  }

  // ==================== PROJECT ====================
  public static getProject(): ProjectSettings {
    return (
      this.cachedProject || {
        ...initialProject,
        siteAddress: initialProject.location,
        projectManager: 'Site Engineer',
      }
    );
  }

  public static async updateProject(updates: Partial<ProjectSettings>): Promise<ProjectSettings> {
    const ownerId = this.getOwnerId();
    const updated: ProjectSettings = {
      ...this.getProject(),
      ...updates,
      ownerId,
      updatedAt: new Date().toISOString(),
    };

    this.cachedProject = updated;
    writeLocalCache(CACHE_KEYS.PROJECT, updated);
    this.notify();

    try {
      const ref = doc(db, 'projects', updated.id);
      await setDoc(ref, updated, { merge: true });
      await this.recordAuditEvent(
        'UPDATE',
        'ProjectSettings',
        updated.id,
        `Updated project parameters: ${updated.name} (${updated.code})`
      );
    } catch (err) {
      console.warn('Failed to update project in Firestore:', err);
    }

    return updated;
  }

  // ==================== RESET & CLEAR ====================
  public static async resetToSeedData(): Promise<void> {
    const ownerId = this.getOwnerId();
    await this.seedUserDataToFirestore(ownerId);
    this.notify();
  }

  public static async clearAllData(): Promise<void> {
    const ownerId = this.getOwnerId();
    const projectId = this.getProjectId();

    // Reset in-memory cache
    const freshProject: ProjectSettings = {
      ...initialProject,
      id: projectId,
      ownerId,
      name: 'New Site Project',
      code: '#FIN-001',
      stage: 'Finishing Phase',
      budgetCap: 27000000,
      activeArtisans: 0,
      siteAddress: 'Plot 4, Lekki Phase 1, Lagos',
      projectManager: 'Site Engineer',
    };

    this.cachedProject = freshProject;
    this.cachedMaterials = [];
    this.cachedPurchases = [];
    this.cachedUsage = [];
    this.cachedWorkProgress = [];
    this.cachedContractors = [];
    this.cachedLabourPayments = [];
    this.cachedTransportation = [];
    this.cachedOtherExpenses = [];

    writeLocalCache(CACHE_KEYS.PROJECT, freshProject);
    writeLocalCache(CACHE_KEYS.MATERIALS, []);
    writeLocalCache(CACHE_KEYS.PURCHASES, []);
    writeLocalCache(CACHE_KEYS.USAGE, []);
    writeLocalCache(CACHE_KEYS.WORK_PROGRESS, []);
    writeLocalCache(CACHE_KEYS.CONTRACTORS, []);
    writeLocalCache(CACHE_KEYS.LABOUR_PAYMENTS, []);
    writeLocalCache(CACHE_KEYS.TRANSPORTATION, []);
    writeLocalCache(CACHE_KEYS.OTHER_EXPENSES, []);
    this.notify();

    try {
      const collectionsToClear = [
        'materials',
        'purchases',
        'materialUsage',
        'workProgress',
        'contractors',
        'labourPayments',
        'transportation',
        'otherExpenses',
      ];

      for (const colName of collectionsToClear) {
        const q = query(collection(db, colName), where('ownerId', '==', ownerId));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      const projRef = doc(db, 'projects', projectId);
      await setDoc(projRef, freshProject);

      await this.recordAuditEvent(
        'RESET',
        'System',
        projectId,
        'Cleared all site records to initialize a clean project'
      );
    } catch (err) {
      console.warn('Failed to clear data in Firestore:', err);
    }
  }

  // ==================== MATERIALS ====================
  public static getMaterials(): Material[] {
    return this.cachedMaterials;
  }

  public static getMaterialById(id: string): Material | undefined {
    return this.cachedMaterials.find((m) => m.id === id);
  }

  public static async saveMaterial(
    material: Omit<Material, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<Material> {
    const ownerId = this.getOwnerId();
    const projectId = this.getProjectId();
    const now = new Date().toISOString();

    let saved: Material;
    if (material.id) {
      const existing = this.cachedMaterials.find((m) => m.id === material.id);
      saved = {
        ...(existing || {}),
        ...material,
        id: material.id,
        projectId,
        ownerId,
        remaining: Math.max(0, material.totalPurchased - material.totalUsed),
        updatedAt: now,
      } as Material;
      const idx = this.cachedMaterials.findIndex((m) => m.id === material.id);
      if (idx >= 0) this.cachedMaterials[idx] = saved;
      else this.cachedMaterials.unshift(saved);
    } else {
      saved = {
        ...material,
        id: `mat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        projectId,
        ownerId,
        remaining: Math.max(0, material.totalPurchased - material.totalUsed),
        createdAt: now,
        updatedAt: now,
      };
      this.cachedMaterials.unshift(saved);
    }

    writeLocalCache(CACHE_KEYS.MATERIALS, this.cachedMaterials);
    this.notify();

    try {
      const ref = doc(db, 'materials', saved.id);
      await setDoc(ref, saved);
      await this.recordAuditEvent(
        material.id ? 'UPDATE' : 'CREATE',
        'Material',
        saved.id,
        `${material.id ? 'Updated' : 'Added'} material: ${saved.name} (${saved.unit})`
      );
    } catch (err) {
      console.warn('Failed to save material to Firestore:', err);
    }

    return saved;
  }

  public static async deleteMaterial(id: string): Promise<void> {
    const target = this.cachedMaterials.find((m) => m.id === id);
    this.cachedMaterials = this.cachedMaterials.filter((m) => m.id !== id);
    writeLocalCache(CACHE_KEYS.MATERIALS, this.cachedMaterials);
    this.notify();

    try {
      const ref = doc(db, 'materials', id);
      await deleteDoc(ref);
      await this.recordAuditEvent('DELETE', 'Material', id, `Deleted material: ${target?.name || id}`);
    } catch (err) {
      console.warn('Failed to delete material from Firestore:', err);
    }
  }

  // ==================== PURCHASES ====================
  public static getPurchases(): PurchaseRecord[] {
    return this.cachedPurchases;
  }

  public static async savePurchase(
    data: Omit<
      PurchaseRecord,
      'id' | 'materialCost' | 'acquisitionCost' | 'supplierBalance' | 'supplierOverpayment' | 'createdAt' | 'updatedAt'
    > & { id?: string }
  ): Promise<PurchaseRecord> {
    const ownerId = this.getOwnerId();
    const projectId = this.getProjectId();
    const now = new Date().toISOString();

    const oldPurchase = data.id ? this.cachedPurchases.find((p) => p.id === data.id) : undefined;
    const oldMaterialId = oldPurchase?.materialId;

    // Authoritative calculation using safe integer kobo arithmetic
    const { materialCost, acquisitionCost, supplierBalance, supplierOverpayment } = calculatePurchaseTotals(
      data.quantity,
      data.unitPrice,
      data.haulageCost || 0,
      data.offloadingCost || 0,
      data.otherCost || 0,
      data.amountPaid || 0
    );

    // Resolve or establish stable materialId
    let resolvedMaterialId = data.materialId;
    if (!resolvedMaterialId) {
      const existingMat = this.cachedMaterials.find(
        (m) => m.name.toLowerCase().trim() === data.materialName.toLowerCase().trim()
      );
      if (existingMat) {
        resolvedMaterialId = existingMat.id;
      } else {
        // Create material first so stable ID is established
        resolvedMaterialId = `mat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        const newMat: Material = {
          id: resolvedMaterialId,
          projectId,
          ownerId,
          name: data.materialName.trim(),
          category: data.category,
          unit: data.unit,
          totalPurchased: data.quantity,
          totalUsed: 0,
          remaining: data.quantity,
          avgUnitPrice: data.unitPrice,
          totalCost: materialCost,
          supplier: data.supplier,
          createdAt: now,
          updatedAt: now,
        };
        this.cachedMaterials.unshift(newMat);
        writeLocalCache(CACHE_KEYS.MATERIALS, this.cachedMaterials);
        // Persist new material to Firestore
        setDoc(doc(db, 'materials', newMat.id), newMat).catch((e) => console.warn(e));
      }
    }

    let savedPurchase: PurchaseRecord;

    if (data.id) {
      const index = this.cachedPurchases.findIndex((p) => p.id === data.id);
      savedPurchase = {
        ...(this.cachedPurchases[index] || {}),
        ...data,
        id: data.id,
        projectId,
        ownerId,
        materialId: resolvedMaterialId,
        materialCost,
        acquisitionCost,
        supplierBalance,
        supplierOverpayment,
        updatedAt: now,
      } as PurchaseRecord;
      if (index >= 0) this.cachedPurchases[index] = savedPurchase;
      else this.cachedPurchases.unshift(savedPurchase);
    } else {
      savedPurchase = {
        ...data,
        id: `pur_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        projectId,
        ownerId,
        materialId: resolvedMaterialId,
        materialCost,
        acquisitionCost,
        supplierBalance,
        supplierOverpayment,
        createdAt: now,
        updatedAt: now,
      };
      this.cachedPurchases.unshift(savedPurchase);
    }

    writeLocalCache(CACHE_KEYS.PURCHASES, this.cachedPurchases);
    this.notify();

    // Reconcile stock for current material
    await this.reconcileMaterialInventory(resolvedMaterialId);

    // If materialId changed on edit, also reconcile old material inventory!
    if (oldMaterialId && oldMaterialId !== resolvedMaterialId) {
      await this.reconcileMaterialInventory(oldMaterialId);
    }

    // Persist to Firestore
    try {
      const ref = doc(db, 'purchases', savedPurchase.id);
      await setDoc(ref, savedPurchase);
      await this.recordAuditEvent(
        data.id ? 'UPDATE' : 'CREATE',
        'Purchase',
        savedPurchase.id,
        `${data.id ? 'Edited' : 'Created'} purchase: ${savedPurchase.quantity} ${savedPurchase.unit} of ${savedPurchase.materialName} (Landed: ₦${acquisitionCost.toLocaleString()})`
      );
    } catch (err) {
      console.warn('Failed to save purchase in Firestore:', err);
    }

    return savedPurchase;
  }

  public static async deletePurchase(id: string): Promise<void> {
    const target = this.cachedPurchases.find((p) => p.id === id);
    this.cachedPurchases = this.cachedPurchases.filter((p) => p.id !== id);
    writeLocalCache(CACHE_KEYS.PURCHASES, this.cachedPurchases);
    this.notify();

    if (target?.materialId) {
      await this.reconcileMaterialInventory(target.materialId);
    }

    try {
      const ref = doc(db, 'purchases', id);
      await deleteDoc(ref);
      await this.recordAuditEvent(
        'DELETE',
        'Purchase',
        id,
        `Deleted purchase: ${target?.materialName || id} (${target?.quantity || 0} ${target?.unit || ''})`
      );
    } catch (err) {
      console.warn('Failed to delete purchase from Firestore:', err);
    }
  }

  // ==================== MATERIAL USAGE ====================
  public static getMaterialUsage(): MaterialUsage[] {
    return this.cachedUsage;
  }

  public static async saveUsage(
    data: Omit<MaterialUsage, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<MaterialUsage> {
    const ownerId = this.getOwnerId();
    const projectId = this.getProjectId();
    const now = new Date().toISOString();

    const oldUsage = data.id ? this.cachedUsage.find((u) => u.id === data.id) : undefined;
    const oldMaterialId = oldUsage?.materialId;

    // 1. Authoritative Negative-Stock Protection (Phase 6)
    // Find all purchases for this materialId
    const materialPurchases = this.cachedPurchases.filter(
      (p) => p.materialId === data.materialId || (p.materialName && p.materialName.toLowerCase().trim() === data.materialName.toLowerCase().trim())
    );
    const totalPurchased = materialPurchases.reduce((sum, p) => sum + p.quantity, 0);

    // Other usages of this material excluding the one currently being edited
    const otherUsages = this.cachedUsage
      .filter((u) => (u.materialId === data.materialId || u.materialName.toLowerCase().trim() === data.materialName.toLowerCase().trim()) && u.id !== data.id)
      .reduce((sum, u) => sum + u.quantityUsed, 0);

    const availableStock = Math.max(0, totalPurchased - otherUsages);

    if (data.quantityUsed > availableStock) {
      throw new Error(
        `Requested usage (${data.quantityUsed} ${data.unit}) exceeds available stock (${availableStock} ${data.unit}). Negative stock is not allowed.`
      );
    }

    let savedUsage: MaterialUsage;
    if (data.id) {
      const idx = this.cachedUsage.findIndex((u) => u.id === data.id);
      savedUsage = {
        ...(this.cachedUsage[idx] || {}),
        ...data,
        id: data.id,
        projectId,
        ownerId,
        updatedAt: now,
      } as MaterialUsage;
      if (idx >= 0) this.cachedUsage[idx] = savedUsage;
      else this.cachedUsage.unshift(savedUsage);
    } else {
      savedUsage = {
        ...data,
        id: `use_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        projectId,
        ownerId,
        createdAt: now,
        updatedAt: now,
      };
      this.cachedUsage.unshift(savedUsage);
    }

    writeLocalCache(CACHE_KEYS.USAGE, this.cachedUsage);
    this.notify();

    // Reconcile material inventory
    await this.reconcileMaterialInventory(data.materialId);

    // If materialId changed, reconcile old material as well!
    if (oldMaterialId && oldMaterialId !== data.materialId) {
      await this.reconcileMaterialInventory(oldMaterialId);
    }

    // Persist to Firestore
    try {
      const ref = doc(db, 'materialUsage', savedUsage.id);
      await setDoc(ref, savedUsage);
      await this.recordAuditEvent(
        data.id ? 'UPDATE' : 'CREATE',
        'MaterialUsage',
        savedUsage.id,
        `${data.id ? 'Edited' : 'Logged'} usage: ${savedUsage.quantityUsed} ${savedUsage.unit} of ${savedUsage.materialName} at ${savedUsage.workArea}`
      );
    } catch (err) {
      console.warn('Failed to save material usage in Firestore:', err);
    }

    return savedUsage;
  }

  public static async deleteUsage(id: string): Promise<void> {
    const target = this.cachedUsage.find((u) => u.id === id);
    this.cachedUsage = this.cachedUsage.filter((u) => u.id !== id);
    writeLocalCache(CACHE_KEYS.USAGE, this.cachedUsage);
    this.notify();

    if (target?.materialId) {
      await this.reconcileMaterialInventory(target.materialId);
    }

    try {
      const ref = doc(db, 'materialUsage', id);
      await deleteDoc(ref);
      await this.recordAuditEvent(
        'DELETE',
        'MaterialUsage',
        id,
        `Deleted usage: ${target?.quantityUsed || 0} ${target?.unit || ''} of ${target?.materialName || id}`
      );
    } catch (err) {
      console.warn('Failed to delete usage from Firestore:', err);
    }
  }

  /**
   * Authoritative reconciliation of material stock from purchase and usage records (Phase 6 & 7)
   */
  private static async reconcileMaterialInventory(materialId: string): Promise<void> {
    const mat = this.cachedMaterials.find((m) => m.id === materialId);
    if (!mat) return;

    const purchases = this.cachedPurchases.filter(
      (p) => p.materialId === materialId || p.materialName.toLowerCase().trim() === mat.name.toLowerCase().trim()
    );
    const usages = this.cachedUsage.filter(
      (u) => u.materialId === materialId || u.materialName.toLowerCase().trim() === mat.name.toLowerCase().trim()
    );

    const totalPurchased = purchases.reduce((sum, p) => sum + p.quantity, 0);
    const totalMaterialCost = purchases.reduce((sum, p) => sum + p.materialCost, 0);
    const avgUnitPrice = totalPurchased > 0 ? Math.round(totalMaterialCost / totalPurchased) : mat.avgUnitPrice;
    const totalUsed = usages.reduce((sum, u) => sum + u.quantityUsed, 0);
    const remaining = Math.max(0, totalPurchased - totalUsed);

    const updatedMat: Material = {
      ...mat,
      totalPurchased,
      totalUsed,
      remaining,
      avgUnitPrice,
      totalCost: totalMaterialCost,
      updatedAt: new Date().toISOString(),
    };

    const idx = this.cachedMaterials.findIndex((m) => m.id === materialId);
    if (idx >= 0) {
      this.cachedMaterials[idx] = updatedMat;
      writeLocalCache(CACHE_KEYS.MATERIALS, this.cachedMaterials);
      this.notify();

      try {
        const ref = doc(db, 'materials', materialId);
        await setDoc(ref, updatedMat, { merge: true });
      } catch (e) {
        console.warn('Error syncing material inventory to Firestore:', e);
      }
    }
  }

  // ==================== WORK PROGRESS ====================
  public static getWorkProgress(): WorkProgressItem[] {
    return this.cachedWorkProgress;
  }

  public static async saveWorkProgress(
    data: Omit<WorkProgressItem, 'id' | 'outstanding' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<WorkProgressItem> {
    const ownerId = this.getOwnerId();
    const projectId = this.getProjectId();
    const now = new Date().toISOString();

    const safePercent = Math.min(100, Math.max(0, Math.round(data.completionPercent || 0)));
    const safeExpected = Math.max(0, data.expectedBudget || 0);
    const safeActualPaid = Math.max(0, data.actualPaid || 0);
    const outstanding = Math.max(0, safeExpected - safeActualPaid);

    let saved: WorkProgressItem;
    if (data.id) {
      const idx = this.cachedWorkProgress.findIndex((w) => w.id === data.id);
      saved = {
        ...(this.cachedWorkProgress[idx] || {}),
        ...data,
        id: data.id,
        projectId,
        ownerId,
        completionPercent: safePercent,
        expectedBudget: safeExpected,
        actualPaid: safeActualPaid,
        outstanding,
        updatedAt: now,
      } as WorkProgressItem;
      if (idx >= 0) this.cachedWorkProgress[idx] = saved;
      else this.cachedWorkProgress.push(saved);
    } else {
      saved = {
        ...data,
        id: `wp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        projectId,
        ownerId,
        completionPercent: safePercent,
        expectedBudget: safeExpected,
        actualPaid: safeActualPaid,
        outstanding,
        createdAt: now,
        updatedAt: now,
      };
      this.cachedWorkProgress.push(saved);
    }

    writeLocalCache(CACHE_KEYS.WORK_PROGRESS, this.cachedWorkProgress);
    this.notify();

    try {
      const ref = doc(db, 'workProgress', saved.id);
      await setDoc(ref, saved);
      await this.recordAuditEvent(
        data.id ? 'UPDATE' : 'CREATE',
        'WorkProgress',
        saved.id,
        `${data.id ? 'Updated' : 'Created'} stream: ${saved.name} (${saved.completionPercent}% complete)`
      );
    } catch (err) {
      console.warn('Failed to save work progress in Firestore:', err);
    }

    return saved;
  }

  public static async updateWorkPercent(id: string, newPercent: number): Promise<void> {
    const item = this.cachedWorkProgress.find((w) => w.id === id);
    if (!item) return;

    const safePercent = Math.min(100, Math.max(0, Math.round(newPercent)));
    item.completionPercent = safePercent;
    if (safePercent === 100) {
      item.status = 'Completed';
    } else if (safePercent > 0 && item.status === 'Not Started') {
      item.status = 'In Progress';
    }
    item.updatedAt = new Date().toISOString();

    writeLocalCache(CACHE_KEYS.WORK_PROGRESS, this.cachedWorkProgress);
    this.notify();

    try {
      const ref = doc(db, 'workProgress', id);
      await setDoc(ref, item, { merge: true });
    } catch (e) {
      console.warn('Failed to update progress percentage in Firestore:', e);
    }
  }

  public static async deleteWorkProgress(id: string): Promise<void> {
    const target = this.cachedWorkProgress.find((w) => w.id === id);
    this.cachedWorkProgress = this.cachedWorkProgress.filter((w) => w.id !== id);
    writeLocalCache(CACHE_KEYS.WORK_PROGRESS, this.cachedWorkProgress);
    this.notify();

    try {
      const ref = doc(db, 'workProgress', id);
      await deleteDoc(ref);
      await this.recordAuditEvent('DELETE', 'WorkProgress', id, `Deleted work stream: ${target?.name || id}`);
    } catch (err) {
      console.warn('Failed to delete work stream from Firestore:', err);
    }
  }

  // ==================== CONTRACTORS ====================
  public static getContractors(): Contractor[] {
    return this.cachedContractors;
  }

  public static async saveContractor(
    data: Omit<Contractor, 'id' | 'totalPaid' | 'outstandingBalance' | 'overpayment' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    }
  ): Promise<Contractor> {
    const ownerId = this.getOwnerId();
    const projectId = this.getProjectId();
    const now = new Date().toISOString();

    const contractorId = data.id || `cont_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    // Reconcile total paid from labour payment records
    const payments = this.cachedLabourPayments.filter((p) => p.contractorId === contractorId);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    const { outstandingBalance, overpayment } = calculateLabourBalances(data.agreedAmount || 0, totalPaid);

    let saved: Contractor;
    if (data.id) {
      const idx = this.cachedContractors.findIndex((c) => c.id === data.id);
      saved = {
        ...(this.cachedContractors[idx] || {}),
        ...data,
        id: data.id,
        projectId,
        ownerId,
        agreedAmount: Math.max(0, data.agreedAmount || 0),
        totalPaid,
        outstandingBalance,
        overpayment,
        updatedAt: now,
      } as Contractor;
      if (idx >= 0) this.cachedContractors[idx] = saved;
      else this.cachedContractors.unshift(saved);
    } else {
      saved = {
        ...data,
        id: contractorId,
        projectId,
        ownerId,
        agreedAmount: Math.max(0, data.agreedAmount || 0),
        totalPaid,
        outstandingBalance,
        overpayment,
        createdAt: now,
        updatedAt: now,
      };
      this.cachedContractors.unshift(saved);
    }

    writeLocalCache(CACHE_KEYS.CONTRACTORS, this.cachedContractors);
    this.notify();

    try {
      const ref = doc(db, 'contractors', saved.id);
      await setDoc(ref, saved);
      await this.recordAuditEvent(
        data.id ? 'UPDATE' : 'CREATE',
        'Contractor',
        saved.id,
        `${data.id ? 'Updated' : 'Registered'} contractor: ${saved.name} (${saved.trade}) - Agreed: ₦${saved.agreedAmount.toLocaleString()}`
      );
    } catch (err) {
      console.warn('Failed to save contractor in Firestore:', err);
    }

    return saved;
  }

  public static async deleteContractor(id: string): Promise<void> {
    const target = this.cachedContractors.find((c) => c.id === id);
    this.cachedContractors = this.cachedContractors.filter((c) => c.id !== id);
    writeLocalCache(CACHE_KEYS.CONTRACTORS, this.cachedContractors);
    this.notify();

    try {
      const ref = doc(db, 'contractors', id);
      await deleteDoc(ref);
      await this.recordAuditEvent('DELETE', 'Contractor', id, `Deleted contractor: ${target?.name || id}`);
    } catch (err) {
      console.warn('Failed to delete contractor from Firestore:', err);
    }
  }

  // ==================== LABOUR PAYMENTS ====================
  public static getLabourPayments(): LabourPayment[] {
    return this.cachedLabourPayments;
  }

  public static async saveLabourPayment(
    data: Omit<LabourPayment, 'id' | 'createdAt'> & { id?: string }
  ): Promise<LabourPayment> {
    const ownerId = this.getOwnerId();
    const projectId = this.getProjectId();
    const now = new Date().toISOString();

    const oldPayment = data.id ? this.cachedLabourPayments.find((p) => p.id === data.id) : undefined;
    const oldContractorId = oldPayment?.contractorId;

    const safeAmount = Math.max(0, data.amount || 0);

    let saved: LabourPayment;
    if (data.id) {
      const idx = this.cachedLabourPayments.findIndex((p) => p.id === data.id);
      saved = {
        ...(this.cachedLabourPayments[idx] || {}),
        ...data,
        id: data.id,
        projectId,
        ownerId,
        amount: safeAmount,
      } as LabourPayment;
      if (idx >= 0) this.cachedLabourPayments[idx] = saved;
      else this.cachedLabourPayments.unshift(saved);
    } else {
      saved = {
        ...data,
        id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        projectId,
        ownerId,
        amount: safeAmount,
        createdAt: now,
      };
      this.cachedLabourPayments.unshift(saved);
    }

    writeLocalCache(CACHE_KEYS.LABOUR_PAYMENTS, this.cachedLabourPayments);
    this.notify();

    // Reconcile contractor balance (Phase 8)
    await this.reconcileContractorPaymentTotals(saved.contractorId);
    if (oldContractorId && oldContractorId !== saved.contractorId) {
      await this.reconcileContractorPaymentTotals(oldContractorId);
    }

    try {
      const ref = doc(db, 'labourPayments', saved.id);
      await setDoc(ref, saved);
      await this.recordAuditEvent(
        data.id ? 'UPDATE' : 'CREATE',
        'LabourPayment',
        saved.id,
        `${data.id ? 'Edited' : 'Logged'} labour payment of ₦${saved.amount.toLocaleString()} to ${saved.contractorName} (${saved.milestoneTitle})`
      );
    } catch (err) {
      console.warn('Failed to save labour payment in Firestore:', err);
    }

    return saved;
  }

  public static async deleteLabourPayment(id: string): Promise<void> {
    const target = this.cachedLabourPayments.find((p) => p.id === id);
    this.cachedLabourPayments = this.cachedLabourPayments.filter((p) => p.id !== id);
    writeLocalCache(CACHE_KEYS.LABOUR_PAYMENTS, this.cachedLabourPayments);
    this.notify();

    if (target?.contractorId) {
      await this.reconcileContractorPaymentTotals(target.contractorId);
    }

    try {
      const ref = doc(db, 'labourPayments', id);
      await deleteDoc(ref);
      await this.recordAuditEvent(
        'DELETE',
        'LabourPayment',
        id,
        `Deleted labour payment: ₦${target?.amount?.toLocaleString() || 0} to ${target?.contractorName || id}`
      );
    } catch (err) {
      console.warn('Failed to delete labour payment from Firestore:', err);
    }
  }

  private static async reconcileContractorPaymentTotals(contractorId: string): Promise<void> {
    const contractor = this.cachedContractors.find((c) => c.id === contractorId);
    if (!contractor) return;

    const payments = this.cachedLabourPayments.filter((p) => p.contractorId === contractorId);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const { outstandingBalance, overpayment } = calculateLabourBalances(contractor.agreedAmount, totalPaid);

    const updated: Contractor = {
      ...contractor,
      totalPaid,
      outstandingBalance,
      overpayment,
      updatedAt: new Date().toISOString(),
    };

    const idx = this.cachedContractors.findIndex((c) => c.id === contractorId);
    if (idx >= 0) {
      this.cachedContractors[idx] = updated;
      writeLocalCache(CACHE_KEYS.CONTRACTORS, this.cachedContractors);
      this.notify();

      try {
        const ref = doc(db, 'contractors', contractorId);
        await setDoc(ref, updated, { merge: true });
      } catch (e) {
        console.warn('Failed to update contractor in Firestore:', e);
      }
    }
  }

  // ==================== TRANSPORTATION ====================
  public static getTransportation(): TransportationRecord[] {
    return this.cachedTransportation;
  }

  public static async saveTransportation(
    data: Omit<TransportationRecord, 'id' | 'createdAt'> & { id?: string }
  ): Promise<TransportationRecord> {
    const ownerId = this.getOwnerId();
    const projectId = this.getProjectId();
    const now = new Date().toISOString();
    const safeCost = Math.max(0, data.cost || 0);

    let saved: TransportationRecord;
    if (data.id) {
      const idx = this.cachedTransportation.findIndex((r) => r.id === data.id);
      saved = {
        ...(this.cachedTransportation[idx] || {}),
        ...data,
        id: data.id,
        projectId,
        ownerId,
        cost: safeCost,
      } as TransportationRecord;
      if (idx >= 0) this.cachedTransportation[idx] = saved;
      else this.cachedTransportation.unshift(saved);
    } else {
      saved = {
        ...data,
        id: `trans_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        projectId,
        ownerId,
        cost: safeCost,
        createdAt: now,
      };
      this.cachedTransportation.unshift(saved);
    }

    writeLocalCache(CACHE_KEYS.TRANSPORTATION, this.cachedTransportation);
    this.notify();

    try {
      const ref = doc(db, 'transportation', saved.id);
      await setDoc(ref, saved);
      await this.recordAuditEvent(
        data.id ? 'UPDATE' : 'CREATE',
        'Transportation',
        saved.id,
        `${data.id ? 'Updated' : 'Logged'} haulage: ${saved.itemTransported} - ₦${saved.cost.toLocaleString()} (${saved.from} -> ${saved.to})${saved.purchaseId ? ' [Linked to Purchase]' : ' [Independent]'}`
      );
    } catch (err) {
      console.warn('Failed to save transportation to Firestore:', err);
    }

    return saved;
  }

  public static async deleteTransportation(id: string): Promise<void> {
    const target = this.cachedTransportation.find((r) => r.id === id);
    this.cachedTransportation = this.cachedTransportation.filter((r) => r.id !== id);
    writeLocalCache(CACHE_KEYS.TRANSPORTATION, this.cachedTransportation);
    this.notify();

    try {
      const ref = doc(db, 'transportation', id);
      await deleteDoc(ref);
      await this.recordAuditEvent(
        'DELETE',
        'Transportation',
        id,
        `Deleted haulage record: ${target?.itemTransported || id} (₦${target?.cost?.toLocaleString() || 0})`
      );
    } catch (err) {
      console.warn('Failed to delete transportation from Firestore:', err);
    }
  }

  // ==================== OTHER EXPENSES ====================
  public static getOtherExpenses(): OtherExpenseRecord[] {
    return this.cachedOtherExpenses;
  }

  public static async saveOtherExpense(
    data: Omit<OtherExpenseRecord, 'id' | 'createdAt'> & { id?: string }
  ): Promise<OtherExpenseRecord> {
    const ownerId = this.getOwnerId();
    const projectId = this.getProjectId();
    const now = new Date().toISOString();
    const safeAmount = Math.max(0, data.amount || 0);

    let saved: OtherExpenseRecord;
    if (data.id) {
      const idx = this.cachedOtherExpenses.findIndex((e) => e.id === data.id);
      saved = {
        ...(this.cachedOtherExpenses[idx] || {}),
        ...data,
        id: data.id,
        projectId,
        ownerId,
        amount: safeAmount,
      } as OtherExpenseRecord;
      if (idx >= 0) this.cachedOtherExpenses[idx] = saved;
      else this.cachedOtherExpenses.unshift(saved);
    } else {
      saved = {
        ...data,
        id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        projectId,
        ownerId,
        amount: safeAmount,
        createdAt: now,
      };
      this.cachedOtherExpenses.unshift(saved);
    }

    writeLocalCache(CACHE_KEYS.OTHER_EXPENSES, this.cachedOtherExpenses);
    this.notify();

    try {
      const ref = doc(db, 'otherExpenses', saved.id);
      await setDoc(ref, saved);
      await this.recordAuditEvent(
        data.id ? 'UPDATE' : 'CREATE',
        'OtherExpense',
        saved.id,
        `${data.id ? 'Updated' : 'Logged'} expense: ${saved.description} - ₦${saved.amount.toLocaleString()} (${saved.category})`
      );
    } catch (err) {
      console.warn('Failed to save other expense in Firestore:', err);
    }

    return saved;
  }

  public static async deleteOtherExpense(id: string): Promise<void> {
    const target = this.cachedOtherExpenses.find((e) => e.id === id);
    this.cachedOtherExpenses = this.cachedOtherExpenses.filter((e) => e.id !== id);
    writeLocalCache(CACHE_KEYS.OTHER_EXPENSES, this.cachedOtherExpenses);
    this.notify();

    try {
      const ref = doc(db, 'otherExpenses', id);
      await deleteDoc(ref);
      await this.recordAuditEvent(
        'DELETE',
        'OtherExpense',
        id,
        `Deleted expense: ${target?.description || id} (₦${target?.amount?.toLocaleString() || 0})`
      );
    } catch (err) {
      console.warn('Failed to delete expense from Firestore:', err);
    }
  }

  // ==================== FINANCIAL & AGGREGATED METRICS ====================
  public static getAggregatedMetrics(): AggregatedMetrics {
    const project = this.getProject();
    const materials = this.cachedMaterials;
    const purchases = this.cachedPurchases;
    const workProgress = this.cachedWorkProgress;
    const contractors = this.cachedContractors;
    const labourPayments = this.cachedLabourPayments;
    const transportation = this.cachedTransportation;
    const otherExpenses = this.cachedOtherExpenses;

    // 1. Purchases Breakdown
    // Landed acquisition costs: materialCost + haulage + offloading + other
    const materialPurchasesTotal = purchases.reduce((sum, p) => sum + p.materialCost, 0);
    const purchaseOffloadingTotal = purchases.reduce((sum, p) => sum + (p.offloadingCost || 0), 0);
    const purchaseOtherCostTotal = purchases.reduce((sum, p) => sum + (p.otherCost || 0), 0);
    const purchaseHaulageSpent = purchases.reduce((sum, p) => sum + (p.haulageCost || 0), 0);

    // Total material spent (landed acquisition total)
    const materialSpent = purchases.reduce((sum, p) => sum + p.acquisitionCost, 0);

    // 2. Transportation Breakdown (Preventing Double-Counting - Phase 4)
    // Independent haulage records: where purchaseId is not set
    const directTransportSpent = transportation
      .filter((t) => !t.purchaseId)
      .reduce((sum, t) => sum + t.cost, 0);

    // Consolidated transportation spend: independent transport records + purchase haulage costs
    // If a transport record has a purchaseId, its cost is already inside that purchase's acquisitionCost!
    const transportationSpent = directTransportSpent + purchaseHaulageSpent;

    // 3. Labour
    const labourSpent = labourPayments.reduce((sum, l) => sum + l.amount, 0);

    // 4. Other Expenses
    const otherSpent = otherExpenses.reduce((sum, e) => sum + e.amount, 0);

    // 5. Total Spent (Committed Landed Spend)
    // Pure Material + Offloading/Other + Total Consolidated Transport + Labour + Other Expenses
    const totalSpent =
      materialPurchasesTotal +
      purchaseOffloadingTotal +
      purchaseOtherCostTotal +
      transportationSpent +
      labourSpent +
      otherSpent;

    // 6. Cash Flow vs Commitment
    // Cash Paid: actual disbursements made out of bank/hand
    const purchaseCashPaid = purchases.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
    const cashExpenditure = purchaseCashPaid + labourSpent + directTransportSpent + otherSpent;

    // Committed Cost: total contractual obligations (landed purchases + agreed labour + direct transport + other expenses)
    const agreedLabourTotal = contractors.reduce((sum, c) => sum + (c.agreedAmount || 0), 0);
    const committedCost = materialSpent + agreedLabourTotal + directTransportSpent + otherSpent;

    // 7. Liabilities & Overpayments (Phase 5)
    const supplierOutstanding = purchases.reduce((sum, p) => sum + (p.supplierBalance || 0), 0);
    const contractorOutstanding = contractors.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
    const totalOutstanding = supplierOutstanding + contractorOutstanding;

    const supplierOverpayment = purchases.reduce((sum, p) => sum + (p.supplierOverpayment || 0), 0);
    const contractorOverpayment = contractors.reduce((sum, c) => sum + (c.overpayment || 0), 0);
    const totalOverpayments = supplierOverpayment + contractorOverpayment;

    // 8. Budget Metrics
    const budgetCap = project.budgetCap || 27000000;
    const remainingBuffer = Math.max(0, budgetCap - totalSpent);
    const forecastRemainingCost = remainingBuffer;
    const contingencyPercent = budgetCap > 0 ? Number(((remainingBuffer / budgetCap) * 100).toFixed(1)) : 0;
    const spentPercent = budgetCap > 0 ? Number(((totalSpent / budgetCap) * 100).toFixed(1)) : 0;

    // 9. Overall Completion Percentage
    let overallCompletionPercent = 0;
    if (workProgress.length > 0) {
      const totalBudgetStreams = workProgress.reduce((sum, w) => sum + w.expectedBudget, 0);
      if (totalBudgetStreams > 0) {
        const weighted = workProgress.reduce(
          (sum, w) => sum + (w.expectedBudget * w.completionPercent) / 100,
          0
        );
        overallCompletionPercent = Math.round((weighted / totalBudgetStreams) * 100);
      } else {
        const sumPercents = workProgress.reduce((sum, w) => sum + w.completionPercent, 0);
        overallCompletionPercent = Math.round(sumPercents / workProgress.length);
      }
    }

    // 10. Inventory Valuation
    const stockInStoreValue = materials.reduce((sum, m) => sum + m.remaining * m.avgUnitPrice, 0);
    const lowStockCount = materials.filter((m) => m.remaining > 0 && m.remaining <= 10).length;
    const depletedCount = materials.filter((m) => m.remaining === 0).length;

    // 11. Category Budgets Matrix
    const catBudgets = this.getCategoryBudgets();
    const budgetCategories: BudgetCostItem[] = [
      this.calculateBudgetCategory('Materials', catBudgets['Materials'] || 15000000, materialSpent),
      this.calculateBudgetCategory('Labour', catBudgets['Labour'] || 6500000, labourSpent),
      this.calculateBudgetCategory('Transportation', catBudgets['Transportation'] || 1500000, transportationSpent),
      this.calculateBudgetCategory('Other Expenses', catBudgets['Other Expenses'] || 4000000, otherSpent),
    ];

    return {
      project,
      cashExpenditure,
      committedCost,
      totalSpent,
      budgetCap,
      remainingBuffer,
      contingencyPercent,
      spentPercent,
      totalOutstanding,
      supplierOutstanding,
      contractorOutstanding,
      totalOverpayments,
      supplierOverpayment,
      contractorOverpayment,
      forecastRemainingCost,
      materialSpent,
      labourSpent,
      transportationSpent,
      otherSpent,
      directTransportSpent,
      purchaseHaulageSpent,
      stockInStoreValue,
      lowStockCount,
      depletedCount,
      budgetCategories,
      materialsCount: materials.length,
      activeStreamsCount: workProgress.filter((w) => w.status === 'In Progress').length,
      overallCompletionPercent,
    };
  }

  public static getCategoryBudgets(): Record<string, number> {
    return this.cachedCategoryBudgets;
  }

  public static updateCategoryBudget(category: string, newBudget: number): void {
    this.cachedCategoryBudgets[category] = Math.max(0, newBudget);
    writeLocalCache(CACHE_KEYS.CATEGORY_BUDGETS, this.cachedCategoryBudgets);
    this.notify();
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

  // ==================== BACKUP & RESTORE (Phase 15) ====================
  public static exportDatabaseJSON(): string {
    const backup = {
      app: 'DHD Construction Project Tracker',
      version: '2.0-firebase',
      timestamp: new Date().toISOString(),
      ownerId: this.getOwnerId(),
      project: this.getProject(),
      materials: this.cachedMaterials,
      purchases: this.cachedPurchases,
      usage: this.cachedUsage,
      workProgress: this.cachedWorkProgress,
      contractors: this.cachedContractors,
      labourPayments: this.cachedLabourPayments,
      transportation: this.cachedTransportation,
      otherExpenses: this.cachedOtherExpenses,
      categoryBudgets: this.cachedCategoryBudgets,
    };
    return JSON.stringify(backup, null, 2);
  }

  public static async importDatabaseJSON(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') return false;

      const ownerId = this.getOwnerId();
      const projectId = data.project?.id || this.getProjectId();

      // Update in-memory & local cache
      if (data.project) this.cachedProject = { ...data.project, ownerId };
      if (Array.isArray(data.materials)) this.cachedMaterials = data.materials.map((m: any) => ({ ...m, ownerId, projectId }));
      if (Array.isArray(data.purchases)) this.cachedPurchases = data.purchases.map((p: any) => ({ ...p, ownerId, projectId }));
      if (Array.isArray(data.usage)) this.cachedUsage = data.usage.map((u: any) => ({ ...u, ownerId, projectId }));
      if (Array.isArray(data.workProgress)) this.cachedWorkProgress = data.workProgress.map((w: any) => ({ ...w, ownerId, projectId }));
      if (Array.isArray(data.contractors)) this.cachedContractors = data.contractors.map((c: any) => ({ ...c, ownerId, projectId }));
      if (Array.isArray(data.labourPayments)) this.cachedLabourPayments = data.labourPayments.map((l: any) => ({ ...l, ownerId, projectId }));
      if (Array.isArray(data.transportation)) this.cachedTransportation = data.transportation.map((t: any) => ({ ...t, ownerId, projectId }));
      if (Array.isArray(data.otherExpenses)) this.cachedOtherExpenses = data.otherExpenses.map((e: any) => ({ ...e, ownerId, projectId }));

      writeLocalCache(CACHE_KEYS.PROJECT, this.cachedProject);
      writeLocalCache(CACHE_KEYS.MATERIALS, this.cachedMaterials);
      writeLocalCache(CACHE_KEYS.PURCHASES, this.cachedPurchases);
      writeLocalCache(CACHE_KEYS.USAGE, this.cachedUsage);
      writeLocalCache(CACHE_KEYS.WORK_PROGRESS, this.cachedWorkProgress);
      writeLocalCache(CACHE_KEYS.CONTRACTORS, this.cachedContractors);
      writeLocalCache(CACHE_KEYS.LABOUR_PAYMENTS, this.cachedLabourPayments);
      writeLocalCache(CACHE_KEYS.TRANSPORTATION, this.cachedTransportation);
      writeLocalCache(CACHE_KEYS.OTHER_EXPENSES, this.cachedOtherExpenses);

      this.notify();

      // Synchronize to Firestore
      const batch = writeBatch(db);

      if (data.project) {
        batch.set(doc(db, 'projects', this.cachedProject.id), this.cachedProject);
      }
      this.cachedMaterials.forEach((m) => batch.set(doc(db, 'materials', m.id), m));
      this.cachedPurchases.forEach((p) => batch.set(doc(db, 'purchases', p.id), p));
      this.cachedUsage.forEach((u) => batch.set(doc(db, 'materialUsage', u.id), u));
      this.cachedWorkProgress.forEach((w) => batch.set(doc(db, 'workProgress', w.id), w));
      this.cachedContractors.forEach((c) => batch.set(doc(db, 'contractors', c.id), c));
      this.cachedLabourPayments.forEach((l) => batch.set(doc(db, 'labourPayments', l.id), l));
      this.cachedTransportation.forEach((t) => batch.set(doc(db, 'transportation', t.id), t));
      this.cachedOtherExpenses.forEach((e) => batch.set(doc(db, 'otherExpenses', e.id), e));

      await batch.commit();

      await this.recordAuditEvent(
        'RESTORE',
        'System',
        projectId,
        `Restored project state from JSON backup (${this.cachedPurchases.length} purchases, ${this.cachedContractors.length} contractors)`
      );

      return true;
    } catch (e) {
      console.error('Import backup failed:', e);
      return false;
    }
  }
}
