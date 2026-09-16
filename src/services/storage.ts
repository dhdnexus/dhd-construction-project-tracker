import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  limit,
  writeBatch,
  getDoc,
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
  SyncStatus,
  UserProfile,
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

export const STORAGE_UPDATE_EVENT = 'cpt_storage_update';

// Cache keys for offline/instant initial boot with client-neutral prefix
const CACHE_KEYS = {
  PROJECT: 'cpt_cache_project',
  PROJECTS: 'cpt_cache_projects',
  ACTIVE_PROJECT_ID: 'cpt_cache_active_project_id',
  MATERIALS: 'cpt_cache_materials',
  PURCHASES: 'cpt_cache_purchases',
  USAGE: 'cpt_cache_usage',
  WORK_PROGRESS: 'cpt_cache_work_progress',
  CONTRACTORS: 'cpt_cache_contractors',
  LABOUR_PAYMENTS: 'cpt_cache_labour_payments',
  TRANSPORTATION: 'cpt_cache_transportation',
  OTHER_EXPENSES: 'cpt_cache_other_expenses',
  CATEGORY_BUDGETS: 'cpt_cache_category_budgets',
  AUDIT_EVENTS: 'cpt_cache_audit_events',
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
  private static subcollectionUnsubscribers: (() => void)[] = [];

  // Sync and error state
  private static syncStatus: SyncStatus = 'synced';
  private static lastError: string | null = null;

  // Multi-project tracking
  private static cachedProjects: ProjectSettings[] = readLocalCache(CACHE_KEYS.PROJECTS, [initialProject]);
  private static activeProjectId: string = readLocalCache(CACHE_KEYS.ACTIVE_PROJECT_ID, initialProject.id);
  private static cachedProject: ProjectSettings = readLocalCache(CACHE_KEYS.PROJECT, initialProject);

  // In-memory data store for synchronous rendering
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
    return this.activeProjectId || this.cachedProject.id || 'proj_default';
  }

  public static getActiveProjectId(): string {
    return this.getProjectId();
  }

  public static getUserEmail(): string {
    return this.currentUser?.email || (this.currentUser?.isAnonymous ? 'Anonymous Engineer' : 'Site User');
  }

  public static getUserProfile(): UserProfile {
    return {
      uid: this.currentUser?.uid || 'anon',
      email: this.currentUser?.email || null,
      displayName: this.currentUser?.displayName || null,
      isAnonymous: this.currentUser?.isAnonymous ?? true,
    };
  }

  public static getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  public static getLastError(): string | null {
    return this.lastError;
  }

  public static clearError(): void {
    this.lastError = null;
    this.syncStatus = 'synced';
    this.notify();
  }

  /**
   * Initializes Firebase Auth listener and binds Firestore real-time snapshots
   */
  public static initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.syncStatus = 'synced';
        this.notify();
      });
      window.addEventListener('offline', () => {
        this.syncStatus = 'offline';
        this.notify();
      });
    }

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.currentUser = user;
        this.setupFirestoreSubscriptions(user.uid);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          this.currentUser = cred.user;
          this.setupFirestoreSubscriptions(cred.user.uid);
        } catch (err: any) {
          console.warn('Anonymous sign-in fallback triggered:', err);
          this.syncStatus = 'error';
          this.lastError = err?.message || 'Failed to authenticate anonymously';
        }
      }
      this.notify();
    });
  }

  /**
   * Setup real-time Firestore collection listeners scoped by ownerId and activeProjectId
   */
  private static setupFirestoreSubscriptions(ownerId: string): void {
    // Clear old global listeners
    this.unsubscribeListeners.forEach((unsub) => unsub());
    this.unsubscribeListeners = [];

    // 1. Listen to projects collection for this owner
    try {
      const projQ = query(collection(db, 'projects'), where('ownerId', '==', ownerId));
      const unsubProjects = onSnapshot(
        projQ,
        async (snapshot) => {
          if (snapshot.empty) {
            // New user without any projects in cloud: Create an initial clean project
            const initialId = `proj_${ownerId.slice(0, 8)}`;
            const cleanProject: ProjectSettings = {
              id: initialId,
              name: 'Finishing Project',
              code: '#LK2-884',
              stage: 'Finishing',
              location: 'Lagos, Nigeria',
              siteAddress: 'Lagos, Nigeria',
              currencySymbol: '₦',
              timezone: 'Africa/Lagos',
              budgetCap: 27000000,
              budgetCapKobo: toKobo(27000000),
              startDate: new Date().toISOString().split('T')[0],
              handoverDate: '2026-12-31',
              status: 'Active',
              currency: 'NGN',
              projectManager: 'Site Engineer',
              activeArtisans: 0,
              ownerId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            try {
              await setDoc(doc(db, 'projects', initialId), cleanProject);
              this.cachedProjects = [cleanProject];
              this.activeProjectId = initialId;
              this.cachedProject = cleanProject;
              writeLocalCache(CACHE_KEYS.PROJECTS, this.cachedProjects);
              writeLocalCache(CACHE_KEYS.ACTIVE_PROJECT_ID, initialId);
              writeLocalCache(CACHE_KEYS.PROJECT, cleanProject);
            } catch (err: any) {
              console.warn('Could not auto-create initial project in Firestore:', err);
            }
          } else {
            const projects: ProjectSettings[] = [];
            snapshot.forEach((d) => projects.push(d.data() as ProjectSettings));
            this.cachedProjects = projects;
            writeLocalCache(CACHE_KEYS.PROJECTS, projects);

            // Verify active project exists in user's projects
            const currentActive = projects.find((p) => p.id === this.activeProjectId);
            if (currentActive) {
              this.cachedProject = currentActive;
            } else if (projects.length > 0) {
              this.activeProjectId = projects[0].id;
              this.cachedProject = projects[0];
              writeLocalCache(CACHE_KEYS.ACTIVE_PROJECT_ID, this.activeProjectId);
            }
            writeLocalCache(CACHE_KEYS.PROJECT, this.cachedProject);
          }

          // Now bind subcollections to the current active project
          this.bindSubcollections(ownerId, this.activeProjectId);
          this.notify();
        },
        (err) => {
          console.warn('Projects listener error:', err);
          this.syncStatus = 'error';
          this.lastError = err.message;
          this.notify();
        }
      );
      this.unsubscribeListeners.push(unsubProjects);
    } catch (err: any) {
      console.warn('Error creating projects listener:', err);
    }

    // 2. Audit Events listener (scoped to ownerId)
    try {
      const auditQ = query(
        collection(db, 'auditEvents'),
        where('ownerId', '==', ownerId),
        limit(50)
      );
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
   * Binds real-time listeners to data subcollections isolated by ownerId AND projectId
   */
  private static bindSubcollections(ownerId: string, projectId: string): void {
    // Unsubscribe previous project listeners
    this.subcollectionUnsubscribers.forEach((unsub) => unsub());
    this.subcollectionUnsubscribers = [];

    const bindProjectCollection = <T extends { id: string }>(
      colName: string,
      cacheKey: string,
      setter: (items: T[]) => void
    ) => {
      try {
        const q = query(
          collection(db, colName),
          where('ownerId', '==', ownerId),
          where('projectId', '==', projectId)
        );
        const unsub = onSnapshot(
          q,
          (snapshot) => {
            const docs: T[] = [];
            snapshot.forEach((d) => {
              docs.push(d.data() as T);
            });
            setter(docs);
            writeLocalCache(cacheKey, docs);
            this.syncStatus = 'synced';
            this.notify();
          },
          (err) => {
            console.warn(`Firestore subscription error on ${colName}:`, err);
            this.syncStatus = 'error';
            this.lastError = err.message;
            this.notify();
          }
        );
        this.subcollectionUnsubscribers.push(unsub);
      } catch (err: any) {
        console.warn(`Error attaching listener to ${colName}:`, err);
      }
    };

    // Materials
    bindProjectCollection<Material>('materials', CACHE_KEYS.MATERIALS, (items) => {
      this.cachedMaterials = items;
    });

    // Purchases
    bindProjectCollection<PurchaseRecord>('purchases', CACHE_KEYS.PURCHASES, (items) => {
      this.cachedPurchases = items.sort(
        (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
      );
    });

    // Material Usage
    bindProjectCollection<MaterialUsage>('materialUsage', CACHE_KEYS.USAGE, (items) => {
      this.cachedUsage = items.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    });

    // Work Progress Streams
    bindProjectCollection<WorkProgressItem>('workProgress', CACHE_KEYS.WORK_PROGRESS, (items) => {
      this.cachedWorkProgress = items;
    });

    // Contractors
    bindProjectCollection<Contractor>('contractors', CACHE_KEYS.CONTRACTORS, (items) => {
      this.cachedContractors = items;
    });

    // Labour Payments
    bindProjectCollection<LabourPayment>('labourPayments', CACHE_KEYS.LABOUR_PAYMENTS, (items) => {
      this.cachedLabourPayments = items.sort(
        (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
      );
    });

    // Transportation
    bindProjectCollection<TransportationRecord>('transportation', CACHE_KEYS.TRANSPORTATION, (items) => {
      this.cachedTransportation = items.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    });

    // Other Expenses
    bindProjectCollection<OtherExpenseRecord>('otherExpenses', CACHE_KEYS.OTHER_EXPENSES, (items) => {
      this.cachedOtherExpenses = items.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    });
  }

  /**
   * Append-only immutable audit logging
   */
  private static async recordAuditEvent(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE',
    entityType: string,
    entityId: string,
    details: string
  ): Promise<void> {
    const ownerId = this.getOwnerId();
    const projectId = this.getProjectId();
    const event: AuditEvent = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      action,
      entityType,
      entity: entityType as any,
      entityId,
      user: this.getUserEmail(),
      userEmail: this.getUserEmail(),
      ownerId,
      projectId,
      details,
      summary: details,
    };

    this.cachedAuditEvents.unshift(event);
    if (this.cachedAuditEvents.length > 50) this.cachedAuditEvents.pop();
    writeLocalCache(CACHE_KEYS.AUDIT_EVENTS, this.cachedAuditEvents);
    this.notify();

    try {
      const ref = doc(db, 'auditEvents', event.id);
      await setDoc(ref, event);
    } catch (err) {
      console.warn('Failed to record audit event in Firestore:', err);
    }
  }

  // ==================== MULTI-PROJECT MANAGEMENT ====================
  public static getProjects(): ProjectSettings[] {
    return this.cachedProjects;
  }

  public static async switchProject(projectId: string): Promise<void> {
    const target = this.cachedProjects.find((p) => p.id === projectId);
    if (!target) return;

    this.activeProjectId = projectId;
    this.cachedProject = target;
    writeLocalCache(CACHE_KEYS.ACTIVE_PROJECT_ID, projectId);
    writeLocalCache(CACHE_KEYS.PROJECT, target);

    const ownerId = this.getOwnerId();
    this.bindSubcollections(ownerId, projectId);
    this.notify();
  }

  public static async createProject(data: Partial<ProjectSettings>): Promise<ProjectSettings> {
    const ownerId = this.getOwnerId();
    const now = new Date().toISOString();
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    const budgetCap = Math.max(0, data.budgetCap || 27000000);
    const newProject: ProjectSettings = {
      id: projectId,
      name: data.name || 'New Construction Project',
      code: data.code || `#PRJ-${Math.floor(100 + Math.random() * 900)}`,
      stage: data.stage || 'Finishing',
      location: data.location || data.siteAddress || 'Lagos, Nigeria',
      siteAddress: data.siteAddress || data.location || 'Lagos, Nigeria',
      currencySymbol: data.currencySymbol || '₦',
      timezone: data.timezone || 'Africa/Lagos',
      budgetCap,
      budgetCapKobo: toKobo(budgetCap),
      startDate: data.startDate || now.split('T')[0],
      handoverDate: data.handoverDate || '2026-12-31',
      status: data.status || 'Active',
      currency: 'NGN',
      projectManager: data.projectManager || 'Site Engineer',
      activeArtisans: data.activeArtisans || 0,
      ownerId,
      createdAt: now,
      updatedAt: now,
    };

    this.syncStatus = 'saving';
    this.notify();

    this.cachedProjects.push(newProject);
    writeLocalCache(CACHE_KEYS.PROJECTS, this.cachedProjects);

    try {
      const ref = doc(db, 'projects', projectId);
      await setDoc(ref, newProject);
      await this.recordAuditEvent('CREATE', 'ProjectSettings', projectId, `Created project: ${newProject.name} (${newProject.code})`);
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to save project to Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to create project in database';
      this.notify();
      throw err;
    }

    // Switch to new project automatically
    await this.switchProject(projectId);
    return newProject;
  }

  public static async deleteProject(projectId: string): Promise<void> {
    if (this.cachedProjects.length <= 1) {
      throw new Error('Cannot delete the only project. Create another project first.');
    }

    this.syncStatus = 'saving';
    this.notify();

    try {
      await deleteDoc(doc(db, 'projects', projectId));
      this.cachedProjects = this.cachedProjects.filter((p) => p.id !== projectId);
      writeLocalCache(CACHE_KEYS.PROJECTS, this.cachedProjects);

      if (this.activeProjectId === projectId) {
        const remaining = this.cachedProjects[0];
        await this.switchProject(remaining.id);
      }

      await this.recordAuditEvent('DELETE', 'ProjectSettings', projectId, `Deleted project id ${projectId}`);
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to delete project';
      this.notify();
      throw err;
    }
  }

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
    const current = this.getProject();
    const budgetCap = updates.budgetCap !== undefined ? Math.max(0, updates.budgetCap) : current.budgetCap;

    const updated: ProjectSettings = {
      ...current,
      ...updates,
      budgetCap,
      budgetCapKobo: toKobo(budgetCap),
      ownerId,
      updatedAt: new Date().toISOString(),
    };

    this.cachedProject = updated;
    const projIdx = this.cachedProjects.findIndex((p) => p.id === updated.id);
    if (projIdx >= 0) this.cachedProjects[projIdx] = updated;

    writeLocalCache(CACHE_KEYS.PROJECT, updated);
    writeLocalCache(CACHE_KEYS.PROJECTS, this.cachedProjects);
    this.syncStatus = 'saving';
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
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to update project in Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to update project';
      this.notify();
      throw err;
    }

    return updated;
  }

  // ==================== AUTH METHODS ====================
  public static getCurrentUser(): User | null {
    return this.currentUser;
  }

  public static async signIn(email: string, pass: string): Promise<void> {
    this.syncStatus = 'saving';
    this.notify();
    try {
      const res = await signInWithEmailAndPassword(auth, email, pass);
      this.currentUser = res.user;
      this.setupFirestoreSubscriptions(res.user.uid);
      this.syncStatus = 'synced';
      this.lastError = null;
      this.notify();
    } catch (err: any) {
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Sign in failed';
      this.notify();
      throw err;
    }
  }

  public static async signUp(email: string, pass: string, displayName?: string): Promise<void> {
    this.syncStatus = 'saving';
    this.notify();
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      if (displayName && res.user) {
        await updateProfile(res.user, { displayName });
      }
      this.currentUser = res.user;
      this.setupFirestoreSubscriptions(res.user.uid);
      this.syncStatus = 'synced';
      this.lastError = null;
      this.notify();
    } catch (err: any) {
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Sign up failed';
      this.notify();
      throw err;
    }
  }

  public static async logout(): Promise<void> {
    await signOut(auth);
    this.currentUser = null;
    // Sign in anonymously to maintain uninterrupted session
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.warn('Anonymous re-sign in failed:', err);
    }
  }

  // ==================== MATERIALS ====================
  public static getMaterials(): Material[] {
    return this.cachedMaterials;
  }

  public static async saveMaterial(
    data: Omit<Material, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<Material> {
    const ownerId = this.getOwnerId();
    const projectId = this.getProjectId();
    const now = new Date().toISOString();

    const unitPriceKobo = toKobo(data.avgUnitPrice || 0);
    const totalCostKobo = toKobo(data.totalCost || 0);

    let savedMaterial: Material;
    if (data.id) {
      const idx = this.cachedMaterials.findIndex((m) => m.id === data.id);
      savedMaterial = {
        ...(this.cachedMaterials[idx] || {}),
        ...data,
        id: data.id,
        projectId,
        ownerId,
        unitPriceKobo,
        totalCostKobo,
        updatedAt: now,
      } as Material;
      if (idx >= 0) this.cachedMaterials[idx] = savedMaterial;
      else this.cachedMaterials.unshift(savedMaterial);
    } else {
      savedMaterial = {
        ...data,
        id: `mat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        projectId,
        ownerId,
        unitPriceKobo,
        totalCostKobo,
        createdAt: now,
        updatedAt: now,
      };
      this.cachedMaterials.unshift(savedMaterial);
    }

    writeLocalCache(CACHE_KEYS.MATERIALS, this.cachedMaterials);
    this.syncStatus = 'saving';
    this.notify();

    try {
      const ref = doc(db, 'materials', savedMaterial.id);
      await setDoc(ref, savedMaterial);
      await this.recordAuditEvent(
        data.id ? 'UPDATE' : 'CREATE',
        'Material',
        savedMaterial.id,
        `${data.id ? 'Updated' : 'Registered'} catalog material: ${savedMaterial.name}`
      );
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to save material to Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to save material';
      this.notify();
      throw err;
    }

    return savedMaterial;
  }

  public static async deleteMaterial(id: string): Promise<void> {
    const target = this.cachedMaterials.find((m) => m.id === id);
    this.cachedMaterials = this.cachedMaterials.filter((m) => m.id !== id);
    writeLocalCache(CACHE_KEYS.MATERIALS, this.cachedMaterials);
    this.syncStatus = 'saving';
    this.notify();

    try {
      const ref = doc(db, 'materials', id);
      await deleteDoc(ref);
      await this.recordAuditEvent('DELETE', 'Material', id, `Deleted material: ${target?.name || id}`);
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to delete material from Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to delete material';
      this.notify();
      throw err;
    }
  }

  // ==================== PURCHASES ====================
  public static getPurchases(): PurchaseRecord[] {
    return this.cachedPurchases;
  }

  public static async savePurchase(
    data: Omit<
      PurchaseRecord,
      | 'id'
      | 'materialCost'
      | 'acquisitionCost'
      | 'supplierBalance'
      | 'supplierOverpayment'
      | 'createdAt'
      | 'updatedAt'
    > & { id?: string }
  ): Promise<PurchaseRecord> {
    const ownerId = this.getOwnerId();
    const projectId = this.getProjectId();
    const now = new Date().toISOString();

    const oldPurchase = data.id ? this.cachedPurchases.find((p) => p.id === data.id) : undefined;
    const oldMaterialId = oldPurchase?.materialId;

    // Accurate integer kobo calculations
    const calc = calculatePurchaseTotals(
      data.quantity,
      data.unitPrice,
      data.haulageCost || 0,
      data.offloadingCost || 0,
      data.otherCost || 0,
      data.amountPaid || 0
    );

    let savedPurchase: PurchaseRecord;
    if (data.id) {
      const idx = this.cachedPurchases.findIndex((p) => p.id === data.id);
      savedPurchase = {
        ...(this.cachedPurchases[idx] || {}),
        ...data,
        id: data.id,
        projectId,
        ownerId,
        materialCost: calc.materialCost,
        acquisitionCost: calc.acquisitionCost,
        supplierBalance: calc.supplierBalance,
        supplierOverpayment: calc.supplierOverpayment,
        materialCostKobo: calc.materialCostKobo,
        acquisitionCostKobo: calc.acquisitionCostKobo,
        supplierBalanceKobo: calc.supplierBalanceKobo,
        supplierOverpaymentKobo: calc.supplierOverpaymentKobo,
        unitPriceKobo: calc.unitPriceKobo,
        amountPaidKobo: calc.amountPaidKobo,
        haulageCostKobo: calc.haulageCostKobo,
        offloadingCostKobo: calc.offloadingCostKobo,
        otherCostKobo: calc.otherCostKobo,
        updatedAt: now,
      } as PurchaseRecord;
      if (idx >= 0) this.cachedPurchases[idx] = savedPurchase;
      else this.cachedPurchases.unshift(savedPurchase);
    } else {
      savedPurchase = {
        ...data,
        id: `purch_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        projectId,
        ownerId,
        materialCost: calc.materialCost,
        acquisitionCost: calc.acquisitionCost,
        supplierBalance: calc.supplierBalance,
        supplierOverpayment: calc.supplierOverpayment,
        materialCostKobo: calc.materialCostKobo,
        acquisitionCostKobo: calc.acquisitionCostKobo,
        supplierBalanceKobo: calc.supplierBalanceKobo,
        supplierOverpaymentKobo: calc.supplierOverpaymentKobo,
        unitPriceKobo: calc.unitPriceKobo,
        amountPaidKobo: calc.amountPaidKobo,
        haulageCostKobo: calc.haulageCostKobo,
        offloadingCostKobo: calc.offloadingCostKobo,
        otherCostKobo: calc.otherCostKobo,
        createdAt: now,
        updatedAt: now,
      };
      this.cachedPurchases.unshift(savedPurchase);
    }

    writeLocalCache(CACHE_KEYS.PURCHASES, this.cachedPurchases);
    this.syncStatus = 'saving';
    this.notify();

    // Reconcile material inventory
    await this.reconcileMaterialInventory(data.materialId);
    if (oldMaterialId && oldMaterialId !== data.materialId) {
      await this.reconcileMaterialInventory(oldMaterialId);
    }

    try {
      const ref = doc(db, 'purchases', savedPurchase.id);
      await setDoc(ref, savedPurchase);
      await this.recordAuditEvent(
        data.id ? 'UPDATE' : 'CREATE',
        'Purchase',
        savedPurchase.id,
        `${data.id ? 'Updated' : 'Logged'} purchase: ${savedPurchase.quantity} ${savedPurchase.unit} of ${savedPurchase.materialName} - ₦${savedPurchase.acquisitionCost.toLocaleString()}`
      );
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to save purchase in Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to save purchase';
      this.notify();
      throw err;
    }

    return savedPurchase;
  }

  public static async deletePurchase(id: string): Promise<void> {
    const target = this.cachedPurchases.find((p) => p.id === id);
    this.cachedPurchases = this.cachedPurchases.filter((p) => p.id !== id);
    writeLocalCache(CACHE_KEYS.PURCHASES, this.cachedPurchases);
    this.syncStatus = 'saving';
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
        `Deleted purchase: ${target?.materialName || id} (₦${target?.acquisitionCost?.toLocaleString() || 0})`
      );
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to delete purchase from Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to delete purchase';
      this.notify();
      throw err;
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

    // Authoritative negative stock protection
    const materialPurchases = this.cachedPurchases.filter(
      (p) =>
        p.materialId === data.materialId ||
        (p.materialName && p.materialName.toLowerCase().trim() === data.materialName.toLowerCase().trim())
    );
    const totalPurchased = materialPurchases.reduce((sum, p) => sum + p.quantity, 0);

    const otherUsages = this.cachedUsage
      .filter(
        (u) =>
          (u.materialId === data.materialId ||
            u.materialName.toLowerCase().trim() === data.materialName.toLowerCase().trim()) &&
          u.id !== data.id
      )
      .reduce((sum, u) => sum + u.quantityUsed, 0);

    const availableStock = Math.max(0, totalPurchased - otherUsages);

    if (data.quantityUsed > availableStock) {
      throw new Error(
        `Requested usage (${data.quantityUsed} ${data.unit}) exceeds available stock (${availableStock} ${data.unit}). Negative inventory is prevented.`
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
    this.syncStatus = 'saving';
    this.notify();

    // Reconcile material inventory
    await this.reconcileMaterialInventory(data.materialId);
    if (oldMaterialId && oldMaterialId !== data.materialId) {
      await this.reconcileMaterialInventory(oldMaterialId);
    }

    try {
      const ref = doc(db, 'materialUsage', savedUsage.id);
      await setDoc(ref, savedUsage);
      await this.recordAuditEvent(
        data.id ? 'UPDATE' : 'CREATE',
        'MaterialUsage',
        savedUsage.id,
        `${data.id ? 'Edited' : 'Logged'} usage: ${savedUsage.quantityUsed} ${savedUsage.unit} of ${savedUsage.materialName} at ${savedUsage.workArea}`
      );
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to save material usage in Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to save material usage';
      this.notify();
      throw err;
    }

    return savedUsage;
  }

  public static async deleteUsage(id: string): Promise<void> {
    const target = this.cachedUsage.find((u) => u.id === id);
    this.cachedUsage = this.cachedUsage.filter((u) => u.id !== id);
    writeLocalCache(CACHE_KEYS.USAGE, this.cachedUsage);
    this.syncStatus = 'saving';
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
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to delete usage from Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to delete usage';
      this.notify();
      throw err;
    }
  }

  /**
   * Authoritative reconciliation of material stock from purchase and usage records
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
      unitPriceKobo: toKobo(avgUnitPrice),
      totalCostKobo: toKobo(totalMaterialCost),
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

    const expectedBudgetKobo = toKobo(safeExpected);
    const actualPaidKobo = toKobo(safeActualPaid);
    const outstandingKobo = toKobo(outstanding);

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
        expectedBudgetKobo,
        actualPaidKobo,
        outstandingKobo,
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
        expectedBudgetKobo,
        actualPaidKobo,
        outstandingKobo,
        createdAt: now,
        updatedAt: now,
      };
      this.cachedWorkProgress.push(saved);
    }

    writeLocalCache(CACHE_KEYS.WORK_PROGRESS, this.cachedWorkProgress);
    this.syncStatus = 'saving';
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
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to save work progress in Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to save work progress';
      this.notify();
      throw err;
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
    this.syncStatus = 'saving';
    this.notify();

    try {
      const ref = doc(db, 'workProgress', id);
      await setDoc(ref, item, { merge: true });
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (e: any) {
      console.warn('Failed to update progress percentage in Firestore:', e);
      this.syncStatus = 'error';
      this.lastError = e?.message || 'Failed to update progress';
      this.notify();
      throw e;
    }
  }

  public static async deleteWorkProgress(id: string): Promise<void> {
    const target = this.cachedWorkProgress.find((w) => w.id === id);
    this.cachedWorkProgress = this.cachedWorkProgress.filter((w) => w.id !== id);
    writeLocalCache(CACHE_KEYS.WORK_PROGRESS, this.cachedWorkProgress);
    this.syncStatus = 'saving';
    this.notify();

    try {
      const ref = doc(db, 'workProgress', id);
      await deleteDoc(ref);
      await this.recordAuditEvent('DELETE', 'WorkProgress', id, `Deleted work stream: ${target?.name || id}`);
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to delete work stream from Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to delete work stream';
      this.notify();
      throw err;
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

    const payments = this.cachedLabourPayments.filter((p) => p.contractorId === contractorId);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    const { outstandingBalance, overpayment, agreedAmountKobo, totalPaidKobo, outstandingBalanceKobo, overpaymentKobo } =
      calculateLabourBalances(data.agreedAmount || 0, totalPaid);

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
        agreedAmountKobo,
        totalPaidKobo,
        outstandingBalanceKobo,
        overpaymentKobo,
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
        agreedAmountKobo,
        totalPaidKobo,
        outstandingBalanceKobo,
        overpaymentKobo,
        createdAt: now,
        updatedAt: now,
      };
      this.cachedContractors.unshift(saved);
    }

    writeLocalCache(CACHE_KEYS.CONTRACTORS, this.cachedContractors);
    this.syncStatus = 'saving';
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
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to save contractor in Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to save contractor';
      this.notify();
      throw err;
    }

    return saved;
  }

  public static async deleteContractor(id: string): Promise<void> {
    const target = this.cachedContractors.find((c) => c.id === id);
    this.cachedContractors = this.cachedContractors.filter((c) => c.id !== id);
    writeLocalCache(CACHE_KEYS.CONTRACTORS, this.cachedContractors);
    this.syncStatus = 'saving';
    this.notify();

    try {
      const ref = doc(db, 'contractors', id);
      await deleteDoc(ref);
      await this.recordAuditEvent('DELETE', 'Contractor', id, `Deleted contractor: ${target?.name || id}`);
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to delete contractor from Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to delete contractor';
      this.notify();
      throw err;
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
    const amountKobo = toKobo(safeAmount);

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
        amountKobo,
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
        amountKobo,
        createdAt: now,
      };
      this.cachedLabourPayments.unshift(saved);
    }

    writeLocalCache(CACHE_KEYS.LABOUR_PAYMENTS, this.cachedLabourPayments);
    this.syncStatus = 'saving';
    this.notify();

    // Reconcile contractor balance
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
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to save labour payment in Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to save labour payment';
      this.notify();
      throw err;
    }

    return saved;
  }

  public static async deleteLabourPayment(id: string): Promise<void> {
    const target = this.cachedLabourPayments.find((p) => p.id === id);
    this.cachedLabourPayments = this.cachedLabourPayments.filter((p) => p.id !== id);
    writeLocalCache(CACHE_KEYS.LABOUR_PAYMENTS, this.cachedLabourPayments);
    this.syncStatus = 'saving';
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
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to delete labour payment from Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to delete labour payment';
      this.notify();
      throw err;
    }
  }

  private static async reconcileContractorPaymentTotals(contractorId: string): Promise<void> {
    const contractor = this.cachedContractors.find((c) => c.id === contractorId);
    if (!contractor) return;

    const payments = this.cachedLabourPayments.filter((p) => p.contractorId === contractorId);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const { outstandingBalance, overpayment, totalPaidKobo, outstandingBalanceKobo, overpaymentKobo } =
      calculateLabourBalances(contractor.agreedAmount, totalPaid);

    const updated: Contractor = {
      ...contractor,
      totalPaid,
      outstandingBalance,
      overpayment,
      totalPaidKobo,
      outstandingBalanceKobo,
      overpaymentKobo,
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
    const costKobo = toKobo(safeCost);

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
        costKobo,
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
        costKobo,
        createdAt: now,
      };
      this.cachedTransportation.unshift(saved);
    }

    writeLocalCache(CACHE_KEYS.TRANSPORTATION, this.cachedTransportation);
    this.syncStatus = 'saving';
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
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to save transportation to Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to save transportation';
      this.notify();
      throw err;
    }

    return saved;
  }

  public static async deleteTransportation(id: string): Promise<void> {
    const target = this.cachedTransportation.find((r) => r.id === id);
    this.cachedTransportation = this.cachedTransportation.filter((r) => r.id !== id);
    writeLocalCache(CACHE_KEYS.TRANSPORTATION, this.cachedTransportation);
    this.syncStatus = 'saving';
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
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to delete transportation from Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to delete transportation';
      this.notify();
      throw err;
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
    const amountKobo = toKobo(safeAmount);

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
        amountKobo,
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
        amountKobo,
        createdAt: now,
      };
      this.cachedOtherExpenses.unshift(saved);
    }

    writeLocalCache(CACHE_KEYS.OTHER_EXPENSES, this.cachedOtherExpenses);
    this.syncStatus = 'saving';
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
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to save other expense in Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to save expense';
      this.notify();
      throw err;
    }

    return saved;
  }

  public static async deleteOtherExpense(id: string): Promise<void> {
    const target = this.cachedOtherExpenses.find((e) => e.id === id);
    this.cachedOtherExpenses = this.cachedOtherExpenses.filter((e) => e.id !== id);
    writeLocalCache(CACHE_KEYS.OTHER_EXPENSES, this.cachedOtherExpenses);
    this.syncStatus = 'saving';
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
      this.syncStatus = 'synced';
      this.lastError = null;
    } catch (err: any) {
      console.warn('Failed to delete expense from Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to delete expense';
      this.notify();
      throw err;
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
    const materialPurchasesTotal = purchases.reduce((sum, p) => sum + p.materialCost, 0);
    const purchaseOffloadingTotal = purchases.reduce((sum, p) => sum + (p.offloadingCost || 0), 0);
    const purchaseOtherCostTotal = purchases.reduce((sum, p) => sum + (p.otherCost || 0), 0);
    const purchaseHaulageSpent = purchases.reduce((sum, p) => sum + (p.haulageCost || 0), 0);

    // Landed acquisition total of material purchases
    const materialSpent = purchases.reduce((sum, p) => sum + p.acquisitionCost, 0);

    // 2. Transportation Breakdown (Preventing Double-Counting)
    // Independent haulage records: where purchaseId is not set
    const directTransportSpent = transportation
      .filter((t) => !t.purchaseId)
      .reduce((sum, t) => sum + t.cost, 0);

    // Consolidated haulage spend: independent transport + purchase haulage costs
    const transportationSpent = directTransportSpent + purchaseHaulageSpent;

    // 3. Labour
    const labourSpent = labourPayments.reduce((sum, l) => sum + l.amount, 0);

    // 4. Other Expenses
    const otherSpent = otherExpenses.reduce((sum, e) => sum + e.amount, 0);

    // 5. Total Spent (Committed Landed Spend)
    const totalSpent =
      materialPurchasesTotal +
      purchaseOffloadingTotal +
      purchaseOtherCostTotal +
      transportationSpent +
      labourSpent +
      otherSpent;

    // 6. Cash Flow vs Commitment
    const purchaseCashPaid = purchases.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
    const cashExpenditure = purchaseCashPaid + labourSpent + directTransportSpent + otherSpent;

    const agreedLabourTotal = contractors.reduce((sum, c) => sum + (c.agreedAmount || 0), 0);
    const committedCost = materialSpent + agreedLabourTotal + directTransportSpent + otherSpent;

    // 7. Liabilities & Overpayments
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

  // ==================== RESET & SEED DATA ====================
  public static async resetToSeedData(): Promise<void> {
    const ownerId = this.getOwnerId();
    const projectId = this.getProjectId();

    this.syncStatus = 'saving';
    this.notify();

    try {
      const batch = writeBatch(db);

      // Materials
      const seededMaterials = initialMaterials.map((m) => ({
        ...m,
        ownerId,
        projectId,
        unitPriceKobo: toKobo(m.avgUnitPrice),
        totalCostKobo: toKobo(m.totalCost),
      }));
      seededMaterials.forEach((m) => {
        batch.set(doc(db, 'materials', m.id), m);
      });
      this.cachedMaterials = seededMaterials;

      // Purchases
      const seededPurchases = initialPurchases.map((p) => {
        const calc = calculatePurchaseTotals(
          p.quantity,
          p.unitPrice,
          p.haulageCost || 0,
          p.offloadingCost || 0,
          p.otherCost || 0,
          p.amountPaid || 0
        );
        return {
          ...p,
          ownerId,
          projectId,
          materialCostKobo: calc.materialCostKobo,
          acquisitionCostKobo: calc.acquisitionCostKobo,
          supplierBalanceKobo: calc.supplierBalanceKobo,
          supplierOverpaymentKobo: calc.supplierOverpaymentKobo,
        };
      });
      seededPurchases.forEach((p) => {
        batch.set(doc(db, 'purchases', p.id), p);
      });
      this.cachedPurchases = seededPurchases;

      // Usage
      const seededUsage = initialUsage.map((u) => ({ ...u, ownerId, projectId }));
      seededUsage.forEach((u) => {
        batch.set(doc(db, 'materialUsage', u.id), u);
      });
      this.cachedUsage = seededUsage;

      // Work Progress
      const seededProgress = initialWorkProgress.map((w) => ({
        ...w,
        ownerId,
        projectId,
        expectedBudgetKobo: toKobo(w.expectedBudget),
        actualPaidKobo: toKobo(w.actualPaid),
        outstandingKobo: toKobo(w.outstanding),
      }));
      seededProgress.forEach((w) => {
        batch.set(doc(db, 'workProgress', w.id), w);
      });
      this.cachedWorkProgress = seededProgress;

      // Contractors
      const seededContractors = initialContractors.map((c) => ({
        ...c,
        ownerId,
        projectId,
        agreedAmountKobo: toKobo(c.agreedAmount),
        totalPaidKobo: toKobo(c.totalPaid),
        outstandingBalanceKobo: toKobo(c.outstandingBalance),
        overpaymentKobo: toKobo(c.overpayment),
      }));
      seededContractors.forEach((c) => {
        batch.set(doc(db, 'contractors', c.id), c);
      });
      this.cachedContractors = seededContractors;

      // Labour Payments
      const seededPayments = initialLabourPayments.map((l) => ({
        ...l,
        ownerId,
        projectId,
        amountKobo: toKobo(l.amount),
      }));
      seededPayments.forEach((l) => {
        batch.set(doc(db, 'labourPayments', l.id), l);
      });
      this.cachedLabourPayments = seededPayments;

      // Transportation
      const seededTransport = initialTransportation.map((t) => ({
        ...t,
        ownerId,
        projectId,
        costKobo: toKobo(t.cost),
      }));
      seededTransport.forEach((t) => {
        batch.set(doc(db, 'transportation', t.id), t);
      });
      this.cachedTransportation = seededTransport;

      // Other Expenses
      const seededExpenses = initialOtherExpenses.map((e) => ({
        ...e,
        ownerId,
        projectId,
        amountKobo: toKobo(e.amount),
      }));
      seededExpenses.forEach((e) => {
        batch.set(doc(db, 'otherExpenses', e.id), e);
      });
      this.cachedOtherExpenses = seededExpenses;

      await batch.commit();

      writeLocalCache(CACHE_KEYS.MATERIALS, this.cachedMaterials);
      writeLocalCache(CACHE_KEYS.PURCHASES, this.cachedPurchases);
      writeLocalCache(CACHE_KEYS.USAGE, this.cachedUsage);
      writeLocalCache(CACHE_KEYS.WORK_PROGRESS, this.cachedWorkProgress);
      writeLocalCache(CACHE_KEYS.CONTRACTORS, this.cachedContractors);
      writeLocalCache(CACHE_KEYS.LABOUR_PAYMENTS, this.cachedLabourPayments);
      writeLocalCache(CACHE_KEYS.TRANSPORTATION, this.cachedTransportation);
      writeLocalCache(CACHE_KEYS.OTHER_EXPENSES, this.cachedOtherExpenses);

      await this.recordAuditEvent(
        'RESTORE',
        'System',
        projectId,
        'Loaded demo and benchmark dataset for site finishing'
      );

      this.syncStatus = 'synced';
      this.lastError = null;
      this.notify();
    } catch (err: any) {
      console.warn('Failed to seed demo data into Firestore:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to load demo data';
      this.notify();
      throw err;
    }
  }

  public static async clearAllData(): Promise<void> {
    const ownerId = this.getOwnerId();
    const projectId = this.getProjectId();

    this.syncStatus = 'saving';
    this.notify();

    try {
      const batch = writeBatch(db);

      this.cachedMaterials.forEach((m) => batch.delete(doc(db, 'materials', m.id)));
      this.cachedPurchases.forEach((p) => batch.delete(doc(db, 'purchases', p.id)));
      this.cachedUsage.forEach((u) => batch.delete(doc(db, 'materialUsage', u.id)));
      this.cachedWorkProgress.forEach((w) => batch.delete(doc(db, 'workProgress', w.id)));
      this.cachedContractors.forEach((c) => batch.delete(doc(db, 'contractors', c.id)));
      this.cachedLabourPayments.forEach((l) => batch.delete(doc(db, 'labourPayments', l.id)));
      this.cachedTransportation.forEach((t) => batch.delete(doc(db, 'transportation', t.id)));
      this.cachedOtherExpenses.forEach((e) => batch.delete(doc(db, 'otherExpenses', e.id)));

      await batch.commit();

      this.cachedMaterials = [];
      this.cachedPurchases = [];
      this.cachedUsage = [];
      this.cachedWorkProgress = [];
      this.cachedContractors = [];
      this.cachedLabourPayments = [];
      this.cachedTransportation = [];
      this.cachedOtherExpenses = [];

      writeLocalCache(CACHE_KEYS.MATERIALS, []);
      writeLocalCache(CACHE_KEYS.PURCHASES, []);
      writeLocalCache(CACHE_KEYS.USAGE, []);
      writeLocalCache(CACHE_KEYS.WORK_PROGRESS, []);
      writeLocalCache(CACHE_KEYS.CONTRACTORS, []);
      writeLocalCache(CACHE_KEYS.LABOUR_PAYMENTS, []);
      writeLocalCache(CACHE_KEYS.TRANSPORTATION, []);
      writeLocalCache(CACHE_KEYS.OTHER_EXPENSES, []);

      await this.recordAuditEvent('DELETE', 'System', projectId, 'Cleared all project operational records');
      this.syncStatus = 'synced';
      this.lastError = null;
      this.notify();
    } catch (err: any) {
      console.warn('Failed to clear operational records:', err);
      this.syncStatus = 'error';
      this.lastError = err?.message || 'Failed to clear records';
      this.notify();
      throw err;
    }
  }

  // ==================== BACKUP & RESTORE ====================
  public static exportDatabaseJSON(): string {
    const backup = {
      app: 'Construction Project Tracker',
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

      this.syncStatus = 'saving';
      this.notify();

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

      this.syncStatus = 'synced';
      this.lastError = null;
      this.notify();
      return true;
    } catch (e: any) {
      console.error('Import backup failed:', e);
      this.syncStatus = 'error';
      this.lastError = e?.message || 'Failed to import backup JSON';
      this.notify();
      return false;
    }
  }

  public static getAuditEvents(): AuditEvent[] {
    return this.cachedAuditEvents;
  }
}
