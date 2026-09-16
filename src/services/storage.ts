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
  calculatePurchaseTotalsFromKobo,
  calculateLabourBalances,
  calculateLabourBalancesFromKobo,
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

const EXPLICIT_LOGOUT_KEY = 'cpt_explicit_logout';

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

const EMPTY_PROJECT_FALLBACK: ProjectSettings = {
  id: '',
  name: '',
  code: '',
  stage: '',
  location: '',
  siteAddress: '',
  currencySymbol: '₦',
  timezone: 'Africa/Lagos',
  budgetCap: 0,
  budgetCapKobo: 0,
  startDate: '',
  handoverDate: '',
  status: 'Inactive',
  currency: 'NGN',
  projectManager: '',
  activeArtisans: 0,
};

export class ConstructionTrackerService {
  private static currentUser: User | null = null;
  private static isInitialized = false;
  private static explicitlyLoggedOut =
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem(EXPLICIT_LOGOUT_KEY) === 'true';
  private static unsubscribeListeners: (() => void)[] = [];
  private static subcollectionUnsubscribers: (() => void)[] = [];

  // Sync and error state
  private static syncStatus: SyncStatus = 'synced';
  private static lastError: string | null = null;

  // Multi-project tracking
  private static cachedProjects: ProjectSettings[] = readLocalCache(CACHE_KEYS.PROJECTS, []);
  private static activeProjectId: string = readLocalCache(CACHE_KEYS.ACTIVE_PROJECT_ID, '');
  private static cachedProject: ProjectSettings | null = readLocalCache(CACHE_KEYS.PROJECT, null);

  // In-memory data store for synchronous rendering
  private static cachedMaterials: Material[] = readLocalCache(CACHE_KEYS.MATERIALS, []);
  private static cachedPurchases: PurchaseRecord[] = readLocalCache(CACHE_KEYS.PURCHASES, []);
  private static cachedUsage: MaterialUsage[] = readLocalCache(CACHE_KEYS.USAGE, []);
  private static cachedWorkProgress: WorkProgressItem[] = readLocalCache(CACHE_KEYS.WORK_PROGRESS, []);
  private static cachedContractors: Contractor[] = readLocalCache(CACHE_KEYS.CONTRACTORS, []);
  private static cachedLabourPayments: LabourPayment[] = readLocalCache(CACHE_KEYS.LABOUR_PAYMENTS, []);
  private static cachedTransportation: TransportationRecord[] = readLocalCache(CACHE_KEYS.TRANSPORTATION, []);
  private static cachedOtherExpenses: OtherExpenseRecord[] = readLocalCache(CACHE_KEYS.OTHER_EXPENSES, []);
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
    return this.activeProjectId || this.cachedProject?.id || '';
  }

  public static getActiveProjectId(): string {
    return this.getProjectId();
  }

  public static getUserEmail(): string {
    return this.currentUser?.email || (this.currentUser?.isAnonymous ? 'Anonymous Engineer' : 'Site User');
  }

  public static getUserProfile(): UserProfile {
    return {
      uid: this.currentUser?.uid || '',
      email: this.currentUser?.email || null,
      displayName: this.currentUser?.displayName || null,
      isAnonymous: this.currentUser?.isAnonymous ?? (this.currentUser === null ? false : true),
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
        this.explicitlyLoggedOut = false;
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(EXPLICIT_LOGOUT_KEY);
        }
        this.currentUser = user;
        this.setupFirestoreSubscriptions(user.uid);
      } else {
        this.currentUser = null;
        if (this.explicitlyLoggedOut) {
          // User explicitly logged out: clean unauthenticated state, no anonymous re-login
          this.clearActiveSessionData();
          this.syncStatus = 'synced';
          this.lastError = null;
        } else {
          // First-time guest visitor initialization
          try {
            const cred = await signInAnonymously(auth);
            this.currentUser = cred.user;
            this.setupFirestoreSubscriptions(cred.user.uid);
          } catch (err: any) {
            console.warn('Anonymous initialization fallback triggered:', err);
            this.syncStatus = 'error';
            this.lastError = err?.message || 'Failed to initialize session';
          }
        }
      }
      this.notify();
    });
  }

  private static clearProjectData(): void {
    this.subcollectionUnsubscribers.forEach((unsub) => unsub());
    this.subcollectionUnsubscribers = [];

    this.cachedProjects = [];
    this.activeProjectId = '';
    this.cachedProject = null;
    this.cachedMaterials = [];
    this.cachedPurchases = [];
    this.cachedUsage = [];
    this.cachedWorkProgress = [];
    this.cachedContractors = [];
    this.cachedLabourPayments = [];
    this.cachedTransportation = [];
    this.cachedOtherExpenses = [];

    writeLocalCache(CACHE_KEYS.PROJECTS, []);
    writeLocalCache(CACHE_KEYS.ACTIVE_PROJECT_ID, '');
    writeLocalCache(CACHE_KEYS.PROJECT, null);
    writeLocalCache(CACHE_KEYS.MATERIALS, []);
    writeLocalCache(CACHE_KEYS.PURCHASES, []);
    writeLocalCache(CACHE_KEYS.USAGE, []);
    writeLocalCache(CACHE_KEYS.WORK_PROGRESS, []);
    writeLocalCache(CACHE_KEYS.CONTRACTORS, []);
    writeLocalCache(CACHE_KEYS.LABOUR_PAYMENTS, []);
    writeLocalCache(CACHE_KEYS.TRANSPORTATION, []);
    writeLocalCache(CACHE_KEYS.OTHER_EXPENSES, []);
  }

  private static clearActiveSessionData(): void {
    this.unsubscribeListeners.forEach((unsub) => unsub());
    this.unsubscribeListeners = [];
    this.clearProjectData();
    this.cachedAuditEvents = [];
    writeLocalCache(CACHE_KEYS.AUDIT_EVENTS, []);
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
            // New user with zero projects: Do NOT auto-seed hardcoded production project data.
            // Provide clean empty-project state so user can explicitly create first project.
            this.clearProjectData();
            this.syncStatus = 'synced';
            this.notify();
            return;
          }

          const projects: ProjectSettings[] = [];
          snapshot.forEach((d) => {
            const raw = d.data() as ProjectSettings;
            const budgetCapKobo =
              typeof raw.budgetCapKobo === 'number'
                ? Math.round(raw.budgetCapKobo)
                : toKobo(raw.budgetCap || 0);
            projects.push({
              ...raw,
              budgetCapKobo,
              budgetCap: fromKobo(budgetCapKobo),
            });
          });
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
          } else {
            this.activeProjectId = '';
            this.cachedProject = null;
            writeLocalCache(CACHE_KEYS.ACTIVE_PROJECT_ID, '');
          }
          writeLocalCache(CACHE_KEYS.PROJECT, this.cachedProject);

          // Now bind subcollections to the current active project
          if (this.activeProjectId) {
            this.bindSubcollections(ownerId, this.activeProjectId);
          } else {
            this.subcollectionUnsubscribers.forEach((unsub) => unsub());
            this.subcollectionUnsubscribers = [];
          }
          this.syncStatus = 'synced';
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

    if (!projectId) {
      this.cachedMaterials = [];
      this.cachedPurchases = [];
      this.cachedUsage = [];
      this.cachedWorkProgress = [];
      this.cachedContractors = [];
      this.cachedLabourPayments = [];
      this.cachedTransportation = [];
      this.cachedOtherExpenses = [];
      this.notify();
      return;
    }

    const bindProjectCollection = <T extends { id: string }>(
      colName: string,
      cacheKey: string,
      transform: (raw: any) => T,
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
              docs.push(transform(d.data()));
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
    bindProjectCollection<Material>(
      'materials',
      CACHE_KEYS.MATERIALS,
      (raw: any) => {
        const avgUnitPriceKobo =
          typeof raw.avgUnitPriceKobo === 'number'
            ? Math.round(raw.avgUnitPriceKobo)
            : (typeof raw.unitPriceKobo === 'number' ? Math.round(raw.unitPriceKobo) : toKobo(raw.avgUnitPrice || 0));
        const totalCostKobo =
          typeof raw.totalCostKobo === 'number'
            ? Math.round(raw.totalCostKobo)
            : toKobo(raw.totalCost || 0);
        return {
          ...raw,
          avgUnitPriceKobo,
          unitPriceKobo: avgUnitPriceKobo,
          totalCostKobo,
          avgUnitPrice: fromKobo(avgUnitPriceKobo),
          totalCost: fromKobo(totalCostKobo),
        };
      },
      (items) => {
        this.cachedMaterials = items;
      }
    );

    // Purchases
    bindProjectCollection<PurchaseRecord>(
      'purchases',
      CACHE_KEYS.PURCHASES,
      (raw: any) => {
        const unitPriceKobo = typeof raw.unitPriceKobo === 'number' ? Math.round(raw.unitPriceKobo) : toKobo(raw.unitPrice || 0);
        const haulageCostKobo = typeof raw.haulageCostKobo === 'number' ? Math.round(raw.haulageCostKobo) : toKobo(raw.haulageCost || 0);
        const offloadingCostKobo = typeof raw.offloadingCostKobo === 'number' ? Math.round(raw.offloadingCostKobo) : toKobo(raw.offloadingCost || 0);
        const otherCostKobo = typeof raw.otherCostKobo === 'number' ? Math.round(raw.otherCostKobo) : toKobo(raw.otherCost || 0);
        const amountPaidKobo = typeof raw.amountPaidKobo === 'number' ? Math.round(raw.amountPaidKobo) : toKobo(raw.amountPaid || 0);

        const calc = calculatePurchaseTotalsFromKobo(
          raw.quantity || 0,
          unitPriceKobo,
          haulageCostKobo,
          offloadingCostKobo,
          otherCostKobo,
          amountPaidKobo
        );

        return {
          ...raw,
          unitPriceKobo,
          haulageCostKobo,
          offloadingCostKobo,
          otherCostKobo,
          amountPaidKobo,
          materialCostKobo: calc.materialCostKobo,
          acquisitionCostKobo: calc.acquisitionCostKobo,
          supplierBalanceKobo: calc.supplierBalanceKobo,
          supplierOverpaymentKobo: calc.supplierOverpaymentKobo,
          unitPrice: calc.unitPrice,
          haulageCost: calc.haulageCost,
          offloadingCost: calc.offloadingCost,
          otherCost: calc.otherCost,
          amountPaid: calc.amountPaid,
          materialCost: calc.materialCost,
          acquisitionCost: calc.acquisitionCost,
          supplierBalance: calc.supplierBalance,
          supplierOverpayment: calc.supplierOverpayment,
        };
      },
      (items) => {
        this.cachedPurchases = items.sort(
          (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
        );
      }
    );

    // Material Usage
    bindProjectCollection<MaterialUsage>(
      'materialUsage',
      CACHE_KEYS.USAGE,
      (raw: any) => raw as MaterialUsage,
      (items) => {
        this.cachedUsage = items.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      }
    );

    // Work Progress Streams
    bindProjectCollection<WorkProgressItem>(
      'workProgress',
      CACHE_KEYS.WORK_PROGRESS,
      (raw: any) => {
        const expectedBudgetKobo = typeof raw.expectedBudgetKobo === 'number' ? Math.round(raw.expectedBudgetKobo) : toKobo(raw.expectedBudget || 0);
        const actualPaidKobo = typeof raw.actualPaidKobo === 'number' ? Math.round(raw.actualPaidKobo) : toKobo(raw.actualPaid || 0);
        const outstandingKobo = Math.max(0, expectedBudgetKobo - actualPaidKobo);
        return {
          ...raw,
          expectedBudgetKobo,
          actualPaidKobo,
          outstandingKobo,
          expectedBudget: fromKobo(expectedBudgetKobo),
          actualPaid: fromKobo(actualPaidKobo),
          outstanding: fromKobo(outstandingKobo),
        };
      },
      (items) => {
        this.cachedWorkProgress = items;
      }
    );

    // Contractors
    bindProjectCollection<Contractor>(
      'contractors',
      CACHE_KEYS.CONTRACTORS,
      (raw: any) => {
        const agreedAmountKobo = typeof raw.agreedAmountKobo === 'number' ? Math.round(raw.agreedAmountKobo) : toKobo(raw.agreedAmount || 0);
        const totalPaidKobo = typeof raw.totalPaidKobo === 'number' ? Math.round(raw.totalPaidKobo) : toKobo(raw.totalPaid || 0);
        const { outstandingBalanceKobo, overpaymentKobo } = calculateLabourBalancesFromKobo(agreedAmountKobo, totalPaidKobo);
        return {
          ...raw,
          agreedAmountKobo,
          totalPaidKobo,
          outstandingBalanceKobo,
          overpaymentKobo,
          agreedAmount: fromKobo(agreedAmountKobo),
          totalPaid: fromKobo(totalPaidKobo),
          outstandingBalance: fromKobo(outstandingBalanceKobo),
          overpayment: fromKobo(overpaymentKobo),
        };
      },
      (items) => {
        this.cachedContractors = items;
      }
    );

    // Labour Payments
    bindProjectCollection<LabourPayment>(
      'labourPayments',
      CACHE_KEYS.LABOUR_PAYMENTS,
      (raw: any) => {
        const amountKobo = typeof raw.amountKobo === 'number' ? Math.round(raw.amountKobo) : toKobo(raw.amount || 0);
        return {
          ...raw,
          amountKobo,
          amount: fromKobo(amountKobo),
        };
      },
      (items) => {
        this.cachedLabourPayments = items.sort(
          (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
        );
      }
    );

    // Transportation
    bindProjectCollection<TransportationRecord>(
      'transportation',
      CACHE_KEYS.TRANSPORTATION,
      (raw: any) => {
        const costKobo = typeof raw.costKobo === 'number' ? Math.round(raw.costKobo) : toKobo(raw.cost || 0);
        return {
          ...raw,
          costKobo,
          cost: fromKobo(costKobo),
        };
      },
      (items) => {
        this.cachedTransportation = items.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      }
    );

    // Other Expenses
    bindProjectCollection<OtherExpenseRecord>(
      'otherExpenses',
      CACHE_KEYS.OTHER_EXPENSES,
      (raw: any) => {
        const amountKobo = typeof raw.amountKobo === 'number' ? Math.round(raw.amountKobo) : toKobo(raw.amount || 0);
        return {
          ...raw,
          amountKobo,
          amount: fromKobo(amountKobo),
        };
      },
      (items) => {
        this.cachedOtherExpenses = items.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      }
    );
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
    const projectId = data.id || `proj_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const budgetCapKobo =
      typeof data.budgetCapKobo === 'number'
        ? Math.max(0, Math.round(data.budgetCapKobo))
        : toKobo(Math.max(0, data.budgetCap || 0));
    const budgetCap = fromKobo(budgetCapKobo);

    const newProject: ProjectSettings = {
      id: projectId,
      name: data.name || 'New Project',
      code: data.code || `#PRJ-${Math.floor(100 + Math.random() * 900)}`,
      stage: data.stage || 'Planning',
      location: data.location || data.siteAddress || '',
      siteAddress: data.siteAddress || data.location || '',
      currencySymbol: data.currencySymbol || '₦',
      timezone: data.timezone || 'Africa/Lagos',
      budgetCap,
      budgetCapKobo,
      startDate: data.startDate || now.split('T')[0],
      handoverDate: data.handoverDate || '',
      status: data.status || 'Active',
      currency: data.currency || 'NGN',
      projectManager: data.projectManager || '',
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
      await this.recordAuditEvent(
        'CREATE',
        'ProjectSettings',
        projectId,
        `Created project: ${newProject.name} (${newProject.code})`
      );
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

      await this.recordAuditEvent(
        'DELETE',
        'ProjectSettings',
        projectId,
        `Deleted project id ${projectId}`
      );
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
    if (this.cachedProject) return this.cachedProject;
    if (this.cachedProjects.length > 0) return this.cachedProjects[0];
    return EMPTY_PROJECT_FALLBACK;
  }

  public static async updateProject(updates: Partial<ProjectSettings>): Promise<ProjectSettings> {
    const ownerId = this.getOwnerId();
    const current = this.getProject();
    const budgetCapKobo =
      typeof updates.budgetCapKobo === 'number'
        ? Math.max(0, Math.round(updates.budgetCapKobo))
        : updates.budgetCap !== undefined
        ? toKobo(Math.max(0, updates.budgetCap))
        : current.budgetCapKobo ?? toKobo(current.budgetCap || 0);
    const budgetCap = fromKobo(budgetCapKobo);

    const updated: ProjectSettings = {
      ...current,
      ...updates,
      budgetCap,
      budgetCapKobo,
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
      this.explicitlyLoggedOut = false;
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(EXPLICIT_LOGOUT_KEY);
      }
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
      this.explicitlyLoggedOut = false;
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(EXPLICIT_LOGOUT_KEY);
      }
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
    this.explicitlyLoggedOut = true;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(EXPLICIT_LOGOUT_KEY, 'true');
    }
    // Clean up listeners
    this.subcollectionUnsubscribers.forEach((unsub) => unsub());
    this.subcollectionUnsubscribers = [];
    this.unsubscribeListeners.forEach((unsub) => unsub());
    this.unsubscribeListeners = [];

    // Clear user state
    await signOut(auth);
    this.currentUser = null;
    this.cachedProject = null;
    this.cachedProjects = [];
    this.activeProjectId = '';
    this.cachedMaterials = [];
    this.cachedPurchases = [];
    this.cachedUsage = [];
    this.cachedWorkProgress = [];
    this.cachedContractors = [];
    this.cachedLabourPayments = [];
    this.cachedTransportation = [];
    this.cachedOtherExpenses = [];
    this.cachedAuditEvents = [];

    // Clear local cache for security on logout
    if (typeof window !== 'undefined') {
      Object.values(CACHE_KEYS).forEach((k) => localStorage.removeItem(k));
    }
    this.syncStatus = 'synced';
    this.notify();
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

    const unitPriceKobo =
      typeof data.avgUnitPriceKobo === 'number'
        ? Math.round(data.avgUnitPriceKobo)
        : typeof data.unitPriceKobo === 'number'
        ? Math.round(data.unitPriceKobo)
        : toKobo(data.avgUnitPrice || 0);
    const totalCostKobo =
      typeof data.totalCostKobo === 'number'
        ? Math.round(data.totalCostKobo)
        : toKobo(data.totalCost || 0);
    const avgUnitPrice = fromKobo(unitPriceKobo);
    const totalCost = fromKobo(totalCostKobo);

    let savedMaterial: Material;
    if (data.id) {
      const idx = this.cachedMaterials.findIndex((m) => m.id === data.id);
      savedMaterial = {
        ...(this.cachedMaterials[idx] || {}),
        ...data,
        id: data.id,
        projectId,
        ownerId,
        avgUnitPrice,
        totalCost,
        avgUnitPriceKobo: unitPriceKobo,
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
        avgUnitPrice,
        totalCost,
        avgUnitPriceKobo: unitPriceKobo,
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

    const unitPriceKobo =
      typeof data.unitPriceKobo === 'number'
        ? Math.round(data.unitPriceKobo)
        : toKobo(data.unitPrice || 0);
    const haulageCostKobo =
      typeof data.haulageCostKobo === 'number'
        ? Math.round(data.haulageCostKobo)
        : toKobo(data.haulageCost || 0);
    const offloadingCostKobo =
      typeof data.offloadingCostKobo === 'number'
        ? Math.round(data.offloadingCostKobo)
        : toKobo(data.offloadingCost || 0);
    const otherCostKobo =
      typeof data.otherCostKobo === 'number'
        ? Math.round(data.otherCostKobo)
        : toKobo(data.otherCost || 0);
    const amountPaidKobo =
      typeof data.amountPaidKobo === 'number'
        ? Math.round(data.amountPaidKobo)
        : toKobo(data.amountPaid || 0);

    // Accurate integer kobo calculations
    const calc = calculatePurchaseTotalsFromKobo(
      data.quantity || 0,
      unitPriceKobo,
      haulageCostKobo,
      offloadingCostKobo,
      otherCostKobo,
      amountPaidKobo
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

    const totalPurchased = purchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const totalMaterialCostKobo = purchases.reduce(
      (sum, p) => sum + (p.materialCostKobo ?? toKobo(p.materialCost || 0)),
      0
    );
    const avgUnitPriceKobo =
      totalPurchased > 0
        ? Math.round(totalMaterialCostKobo / totalPurchased)
        : (mat.avgUnitPriceKobo ?? toKobo(mat.avgUnitPrice || 0));
    const totalUsed = usages.reduce((sum, u) => sum + (u.quantityUsed || 0), 0);
    const remaining = Math.max(0, totalPurchased - totalUsed);

    const updatedMat: Material = {
      ...mat,
      totalPurchased,
      totalUsed,
      remaining,
      avgUnitPrice: fromKobo(avgUnitPriceKobo),
      totalCost: fromKobo(totalMaterialCostKobo),
      avgUnitPriceKobo,
      unitPriceKobo: avgUnitPriceKobo,
      totalCostKobo: totalMaterialCostKobo,
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
    const expectedBudgetKobo =
      typeof data.expectedBudgetKobo === 'number'
        ? Math.max(0, Math.round(data.expectedBudgetKobo))
        : toKobo(Math.max(0, data.expectedBudget || 0));
    const actualPaidKobo =
      typeof data.actualPaidKobo === 'number'
        ? Math.max(0, Math.round(data.actualPaidKobo))
        : toKobo(Math.max(0, data.actualPaid || 0));
    const outstandingKobo = Math.max(0, expectedBudgetKobo - actualPaidKobo);

    const safeExpected = fromKobo(expectedBudgetKobo);
    const safeActualPaid = fromKobo(actualPaidKobo);
    const outstanding = fromKobo(outstandingKobo);

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

    const agreedAmountKobo =
      typeof data.agreedAmountKobo === 'number'
        ? Math.max(0, Math.round(data.agreedAmountKobo))
        : toKobo(Math.max(0, data.agreedAmount || 0));

    const payments = this.cachedLabourPayments.filter((p) => p.contractorId === contractorId);
    const totalPaidKobo = payments.reduce(
      (sum, p) => sum + (p.amountKobo ?? toKobo(p.amount || 0)),
      0
    );

    const {
      agreedAmount,
      totalPaid,
      outstandingBalance,
      overpayment,
      outstandingBalanceKobo,
      overpaymentKobo,
    } = calculateLabourBalancesFromKobo(agreedAmountKobo, totalPaidKobo);

    let saved: Contractor;
    if (data.id) {
      const idx = this.cachedContractors.findIndex((c) => c.id === data.id);
      saved = {
        ...(this.cachedContractors[idx] || {}),
        ...data,
        id: data.id,
        projectId,
        ownerId,
        agreedAmount,
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
        agreedAmount,
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

    const amountKobo =
      typeof data.amountKobo === 'number'
        ? Math.max(0, Math.round(data.amountKobo))
        : toKobo(Math.max(0, data.amount || 0));
    const safeAmount = fromKobo(amountKobo);

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
    const totalPaidKobo = payments.reduce(
      (sum, p) => sum + (p.amountKobo ?? toKobo(p.amount || 0)),
      0
    );
    const agreedAmountKobo =
      contractor.agreedAmountKobo ?? toKobo(contractor.agreedAmount || 0);

    const {
      agreedAmount,
      totalPaid,
      outstandingBalance,
      overpayment,
      outstandingBalanceKobo,
      overpaymentKobo,
    } = calculateLabourBalancesFromKobo(agreedAmountKobo, totalPaidKobo);

    const updated: Contractor = {
      ...contractor,
      agreedAmount,
      totalPaid,
      outstandingBalance,
      overpayment,
      agreedAmountKobo,
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
    const costKobo =
      typeof data.costKobo === 'number'
        ? Math.max(0, Math.round(data.costKobo))
        : toKobo(Math.max(0, data.cost || 0));
    const safeCost = fromKobo(costKobo);

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
    const amountKobo =
      typeof data.amountKobo === 'number'
        ? Math.max(0, Math.round(data.amountKobo))
        : toKobo(Math.max(0, data.amount || 0));
    const safeAmount = fromKobo(amountKobo);

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

    // 1. Purchases Breakdown in Kobo
    const materialPurchasesTotalKobo = purchases.reduce(
      (sum, p) => sum + (p.materialCostKobo ?? toKobo(p.materialCost || 0)),
      0
    );
    const purchaseOffloadingTotalKobo = purchases.reduce(
      (sum, p) => sum + (p.offloadingCostKobo ?? toKobo(p.offloadingCost || 0)),
      0
    );
    const purchaseOtherCostTotalKobo = purchases.reduce(
      (sum, p) => sum + (p.otherCostKobo ?? toKobo(p.otherCost || 0)),
      0
    );
    const purchaseHaulageSpentKobo = purchases.reduce(
      (sum, p) => sum + (p.haulageCostKobo ?? toKobo(p.haulageCost || 0)),
      0
    );

    // Landed acquisition total of material purchases in Kobo
    const materialSpentKobo = purchases.reduce(
      (sum, p) => sum + (p.acquisitionCostKobo ?? toKobo(p.acquisitionCost || 0)),
      0
    );

    // 2. Transportation Breakdown (Preventing Double-Counting) in Kobo
    const directTransportSpentKobo = transportation
      .filter((t) => !t.purchaseId)
      .reduce((sum, t) => sum + (t.costKobo ?? toKobo(t.cost || 0)), 0);

    const transportationSpentKobo = directTransportSpentKobo + purchaseHaulageSpentKobo;

    // 3. Labour in Kobo
    const labourSpentKobo = labourPayments.reduce(
      (sum, l) => sum + (l.amountKobo ?? toKobo(l.amount || 0)),
      0
    );

    // 4. Other Expenses in Kobo
    const otherSpentKobo = otherExpenses.reduce(
      (sum, e) => sum + (e.amountKobo ?? toKobo(e.amount || 0)),
      0
    );

    // 5. Total Spent (Committed Landed Spend) in Kobo
    const totalSpentKobo =
      materialPurchasesTotalKobo +
      purchaseOffloadingTotalKobo +
      purchaseOtherCostTotalKobo +
      transportationSpentKobo +
      labourSpentKobo +
      otherSpentKobo;

    // 6. Cash Flow vs Commitment in Kobo
    const purchaseCashPaidKobo = purchases.reduce(
      (sum, p) => sum + (p.amountPaidKobo ?? toKobo(p.amountPaid || 0)),
      0
    );
    const cashExpenditureKobo =
      purchaseCashPaidKobo + labourSpentKobo + directTransportSpentKobo + otherSpentKobo;

    const agreedLabourTotalKobo = contractors.reduce(
      (sum, c) => sum + (c.agreedAmountKobo ?? toKobo(c.agreedAmount || 0)),
      0
    );
    const committedCostKobo =
      materialSpentKobo + agreedLabourTotalKobo + directTransportSpentKobo + otherSpentKobo;

    // 7. Liabilities & Overpayments in Kobo
    const supplierOutstandingKobo = purchases.reduce(
      (sum, p) => sum + (p.supplierBalanceKobo ?? toKobo(p.supplierBalance || 0)),
      0
    );
    const contractorOutstandingKobo = contractors.reduce(
      (sum, c) => sum + (c.outstandingBalanceKobo ?? toKobo(c.outstandingBalance || 0)),
      0
    );
    const totalOutstandingKobo = supplierOutstandingKobo + contractorOutstandingKobo;

    const supplierOverpaymentKobo = purchases.reduce(
      (sum, p) => sum + (p.supplierOverpaymentKobo ?? toKobo(p.supplierOverpayment || 0)),
      0
    );
    const contractorOverpaymentKobo = contractors.reduce(
      (sum, c) => sum + (c.overpaymentKobo ?? toKobo(c.overpayment || 0)),
      0
    );
    const totalOverpaymentsKobo = supplierOverpaymentKobo + contractorOverpaymentKobo;

    // 8. Budget Metrics in Kobo
    const budgetCapKobo = project.budgetCapKobo ?? toKobo(project.budgetCap || 0);
    const remainingBufferKobo = Math.max(0, budgetCapKobo - totalSpentKobo);
    const forecastRemainingCostKobo = remainingBufferKobo;
    const contingencyPercent =
      budgetCapKobo > 0 ? Number(((remainingBufferKobo / budgetCapKobo) * 100).toFixed(1)) : 0;
    const spentPercent =
      budgetCapKobo > 0 ? Number(((totalSpentKobo / budgetCapKobo) * 100).toFixed(1)) : 0;

    // Naira representations for UI consumption
    const materialPurchasesTotal = fromKobo(materialPurchasesTotalKobo);
    const purchaseOffloadingTotal = fromKobo(purchaseOffloadingTotalKobo);
    const purchaseOtherCostTotal = fromKobo(purchaseOtherCostTotalKobo);
    const purchaseHaulageSpent = fromKobo(purchaseHaulageSpentKobo);
    const materialSpent = fromKobo(materialSpentKobo);
    const directTransportSpent = fromKobo(directTransportSpentKobo);
    const transportationSpent = fromKobo(transportationSpentKobo);
    const labourSpent = fromKobo(labourSpentKobo);
    const otherSpent = fromKobo(otherSpentKobo);
    const totalSpent = fromKobo(totalSpentKobo);
    const cashExpenditure = fromKobo(cashExpenditureKobo);
    const committedCost = fromKobo(committedCostKobo);
    const supplierOutstanding = fromKobo(supplierOutstandingKobo);
    const contractorOutstanding = fromKobo(contractorOutstandingKobo);
    const totalOutstanding = fromKobo(totalOutstandingKobo);
    const supplierOverpayment = fromKobo(supplierOverpaymentKobo);
    const contractorOverpayment = fromKobo(contractorOverpaymentKobo);
    const totalOverpayments = fromKobo(totalOverpaymentsKobo);
    const budgetCap = fromKobo(budgetCapKobo);
    const remainingBuffer = fromKobo(remainingBufferKobo);
    const forecastRemainingCost = fromKobo(forecastRemainingCostKobo);

    // 9. Overall Completion Percentage
    let overallCompletionPercent = 0;
    if (workProgress.length > 0) {
      const totalBudgetStreams = workProgress.reduce(
        (sum, w) => sum + (w.expectedBudgetKobo ?? toKobo(w.expectedBudget || 0)),
        0
      );
      if (totalBudgetStreams > 0) {
        const weighted = workProgress.reduce(
          (sum, w) =>
            sum +
            ((w.expectedBudgetKobo ?? toKobo(w.expectedBudget || 0)) * w.completionPercent) / 100,
          0
        );
        overallCompletionPercent = Math.round((weighted / totalBudgetStreams) * 100);
      } else {
        const sumPercents = workProgress.reduce((sum, w) => sum + w.completionPercent, 0);
        overallCompletionPercent = Math.round(sumPercents / workProgress.length);
      }
    }

    // 10. Inventory Valuation
    const stockInStoreValueKobo = materials.reduce(
      (sum, m) =>
        sum + Math.round(m.remaining * (m.avgUnitPriceKobo ?? toKobo(m.avgUnitPrice || 0))),
      0
    );
    const stockInStoreValue = fromKobo(stockInStoreValueKobo);
    const lowStockCount = materials.filter((m) => m.remaining > 0 && m.remaining <= 10).length;
    const depletedCount = materials.filter((m) => m.remaining === 0).length;

    // 11. Category Budgets Matrix
    const catBudgets = this.getCategoryBudgets();
    const baseBudget = budgetCap > 0 ? budgetCap : 0;
    const defaultMaterials = baseBudget > 0 ? Math.round(baseBudget * 0.55) : 0;
    const defaultLabour = baseBudget > 0 ? Math.round(baseBudget * 0.25) : 0;
    const defaultTransport = baseBudget > 0 ? Math.round(baseBudget * 0.06) : 0;
    const defaultOther =
      baseBudget > 0
        ? Math.max(0, baseBudget - defaultMaterials - defaultLabour - defaultTransport)
        : 0;

    const budgetCategories: BudgetCostItem[] = [
      this.calculateBudgetCategory(
        'Materials',
        catBudgets['Materials'] ?? defaultMaterials,
        materialSpent
      ),
      this.calculateBudgetCategory('Labour', catBudgets['Labour'] ?? defaultLabour, labourSpent),
      this.calculateBudgetCategory(
        'Transportation',
        catBudgets['Transportation'] ?? defaultTransport,
        transportationSpent
      ),
      this.calculateBudgetCategory(
        'Other Expenses',
        catBudgets['Other Expenses'] ?? defaultOther,
        otherSpent
      ),
    ];

    return {
      project,
      // Authoritative integer kobo aggregates
      cashExpenditureKobo,
      committedCostKobo,
      totalSpentKobo,
      budgetCapKobo,
      remainingBufferKobo,
      totalOutstandingKobo,
      supplierOutstandingKobo,
      contractorOutstandingKobo,
      totalOverpaymentsKobo,
      supplierOverpaymentKobo,
      contractorOverpaymentKobo,
      materialSpentKobo,
      labourSpentKobo,
      transportationSpentKobo,
      otherSpentKobo,
      directTransportSpentKobo,
      purchaseHaulageSpentKobo,
      stockInStoreValueKobo,
      // Derived Naira aggregates
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
    const budgetKobo = toKobo(budget);
    const actualKobo = toKobo(actual);
    const varianceKobo = budgetKobo - actualKobo;
    const remainingKobo = Math.max(0, varianceKobo);
    const variance = fromKobo(varianceKobo);
    const remaining = fromKobo(remainingKobo);
    const percentUsed = budgetKobo > 0 ? Number(((actualKobo / budgetKobo) * 100).toFixed(1)) : 0;

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
      budgetKobo,
      actualKobo,
      allocatedBudgetKobo: budgetKobo,
      actualSpentKobo: actualKobo,
      varianceKobo,
      remainingKobo,
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
