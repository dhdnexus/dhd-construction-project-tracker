import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  Banknote,
  BriefcaseBusiness,
  CircleAlert,
  Percent,
  WalletCards,
  ChevronRight,
  CircleDollarSign,
  FileClock,
  FolderKanban,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
  Trash2,
  ShieldAlert,
  X,
} from 'lucide-react';
import { AdminProfile } from '../services/adminAuth';
import {
  AdminAuditRecord,
  AdminOverview,
  AdminProjectRecord,
  AdminUserRecord,
  AdminProjectIntelligence,
  loadAdminOverview,
  loadAdminProjectIntelligence,
} from '../services/adminData';
import { formatDate, formatNairaCompact } from '../utils/formatters';
import { AppLogo } from '../components/common/AppLogo';
import { loadAdminProjectMaterials, deleteAdminMaterial, AdminMaterialRecord } from '../services/adminMaterialControl';
import {
  AdminTransactionEntity,
  AdminTransactionRecord,
  AdminTransactionRegister,
  deleteAdminLabourPayment,
  deleteAdminMaterialUsage,
  deleteAdminOtherExpense,
  deleteAdminPurchase,
  deleteAdminTransportation,
  deleteAdminWorkProgress,
  loadAdminProjectTransactions,
} from '../services/adminTransactionControl';

type AdminTab = 'overview' | 'projects' | 'transactions' | 'users' | 'audit';

interface AdminControlCentreProps {
  admin: AdminProfile;
  onSignOut: () => Promise<void>;
}

function statusClasses(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
    case 'in progress':
      return 'bg-[#DCFCE7] text-[#15803D]';
    case 'completed':
      return 'bg-[#E0E8FF] text-[#0F1E36]';
    case 'on hold':
      return 'bg-[#FEF3C7] text-[#92400E]';
    default:
      return 'bg-[#F1F3FF] text-[#75777E]';
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-white border border-[#E8EDFF] rounded-2xl p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#75777E]">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#081B38]">{value}</p>
          <p className="mt-1 text-[11px] text-[#75777E]">{detail}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-[#F1F3FF] text-[#0F1E36] flex items-center justify-center">
          <Icon size={19} />
        </div>
      </div>
    </div>
  );
}

function ProjectTable({ projects, users, onSelect, selectedId }: { projects: AdminProjectRecord[]; users: AdminUserRecord[]; onSelect: (project: AdminProjectRecord) => void; selectedId: string | null }) {
  const ownerNames = useMemo(() => {
    return new Map(
      users.map((user) => [user.id, user.displayName || user.email || 'Unknown user']),
    );
  }, [users]);

  if (projects.length === 0) {
    return (
      <div className="py-14 text-center text-sm text-[#75777E]">
        No construction projects are registered yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead>
          <tr className="border-b border-[#E8EDFF] text-[10px] uppercase tracking-wider text-[#75777E]">
            <th className="px-4 py-3 font-bold">Project</th>
            <th className="px-4 py-3 font-bold">Owner</th>
            <th className="px-4 py-3 font-bold">Stage</th>
            <th className="px-4 py-3 font-bold">Status</th>
            <th className="px-4 py-3 font-bold text-right">Budget Cap</th>
            <th className="px-4 py-3 font-bold">Updated</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr
              key={project.id}
              onClick={() => onSelect(project)}
              className={`border-b border-[#F0F2FA] last:border-0 hover:bg-[#F9F9FF] cursor-pointer ${selectedId === project.id ? 'bg-[#F1F3FF]' : ''}`}
            >
              <td className="px-4 py-3">
                <div className="font-semibold text-sm text-[#081B38]">{project.name}</div>
                <div className="text-[10px] text-[#75777E]">{project.code || project.id}</div>
              </td>
              <td className="px-4 py-3 text-xs text-[#44474D]">
                {ownerNames.get(project.ownerId) || project.ownerId || 'Unknown'}
              </td>
              <td className="px-4 py-3 text-xs text-[#44474D]">{project.stage || '—'}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold ${statusClasses(project.status)}`}>
                  {project.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs font-bold text-[#081B38]">
                {formatNairaCompact(project.budgetCap)}
              </td>
              <td className="px-4 py-3 text-xs text-[#75777E]">
                {formatDate(project.updatedAt || project.createdAt) || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserTable({ users }: { users: AdminUserRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left">
        <thead>
          <tr className="border-b border-[#E8EDFF] text-[10px] uppercase tracking-wider text-[#75777E]">
            <th className="px-4 py-3 font-bold">Account</th>
            <th className="px-4 py-3 font-bold">Email</th>
            <th className="px-4 py-3 font-bold">Role</th>
            <th className="px-4 py-3 font-bold">UID</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-[#F0F2FA] last:border-0 hover:bg-[#F9F9FF]">
              <td className="px-4 py-3">
                <div className="font-semibold text-sm text-[#081B38]">
                  {user.displayName || 'Unnamed account'}
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-[#44474D]">{user.email || '—'}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold ${
                  user.role === 'admin'
                    ? 'bg-[#EDE9FE] text-[#6B46C1]'
                    : 'bg-[#E8F5FF] text-[#0F4C81]'
                }`}>
                  {user.role === 'admin' && <ShieldCheck size={11} />}
                  {user.role === 'admin' ? 'Administrator' : 'User'}
                </span>
              </td>
              <td className="px-4 py-3 text-[10px] font-mono text-[#75777E] max-w-[220px] truncate">{user.id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransactionTable({
  records,
  onDelete,
  deletingId,
}: {
  records: AdminTransactionRecord[];
  onDelete: (record: AdminTransactionRecord) => void;
  deletingId: string | null;
}) {
  if (records.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-[#75777E]">
        No records of this type are registered for the selected project.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left">
        <thead>
          <tr className="border-b border-[#E8EDFF] text-[10px] uppercase tracking-wider text-[#75777E]">
            <th className="px-4 py-3 font-bold">Record</th>
            <th className="px-4 py-3 font-bold">Details</th>
            <th className="px-4 py-3 font-bold">Date</th>
            <th className="px-4 py-3 font-bold text-right">Amount / Impact</th>
            <th className="px-4 py-3 font-bold text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="border-b border-[#F0F2FA] last:border-0">
              <td className="px-4 py-3">
                <div className="font-semibold text-sm text-[#081B38]">{record.title}</div>
                <div className="text-[10px] text-[#75777E]">{record.entityType} • {record.id}</div>
              </td>
              <td className="px-4 py-3 text-xs text-[#44474D] max-w-[330px]">
                <div className="truncate">{record.subtitle}</div>
                {record.linkedCount ? (
                  <div className="mt-1 text-[10px] font-semibold text-[#9A3412]">
                    {record.linkedCount} linked transport record{record.linkedCount === 1 ? '' : 's'}
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3 text-xs text-[#75777E]">{formatDate(record.date) || '—'}</td>
              <td className="px-4 py-3 text-right text-xs font-mono font-bold text-[#081B38]">
                {record.amountKobo > 0 ? formatNairaCompact(record.amountKobo / 100) : '—'}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onDelete(record)}
                  disabled={deletingId !== null}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#FFF1F2] text-[#BE123C] border border-[#FECDD3] text-[10px] font-bold hover:bg-[#FFE4E6] disabled:opacity-50"
                  title="Permanent administrator deletion"
                >
                  <Trash2 size={13} />
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTable({ events }: { events: AdminAuditRecord[] }) {
  if (events.length === 0) {
    return (
      <div className="py-14 text-center text-sm text-[#75777E]">
        No audit events match the current filters.
      </div>
    );
  }
  return (
    <div className="divide-y divide-[#F0F2FA]">
      {events.slice(0, 30).map((event) => (
        <div key={event.id} className="px-4 py-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F1F3FF] text-[#0F1E36] flex items-center justify-center shrink-0">
            <Activity size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B46C1]">{event.action}</span>
              <span className="text-[10px] text-[#75777E]">{event.entity}</span>
              <span className="text-[10px] text-[#75777E]">•</span>
              <span className="text-[10px] text-[#75777E]">{formatDate(event.timestamp) || 'Unknown date'}</span>
            </div>
            <p className="mt-1 text-xs font-semibold text-[#081B38]">{event.summary || 'Audit event'}</p>
            <p className="mt-0.5 text-[10px] text-[#75777E]">
              {event.userEmail || event.user || 'Unknown user'}{event.projectId ? ` • Project ${event.projectId}` : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export const AdminControlCentre: React.FC<AdminControlCentreProps> = ({ admin, onSignOut }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [data, setData] = useState<AdminOverview>({ users: [], projects: [], auditEvents: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectIntelligence, setProjectIntelligence] = useState<AdminProjectIntelligence | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectMaterials, setProjectMaterials] = useState<AdminMaterialRecord[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);
  const [pendingDeleteMaterial, setPendingDeleteMaterial] = useState<AdminMaterialRecord | null>(null);
  const [transactions, setTransactions] = useState<AdminTransactionRegister>({
    purchases: [],
    usage: [],
    labourPayments: [],
    transportation: [],
    otherExpenses: [],
    workProgress: [],
  });
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionEntity, setTransactionEntity] = useState<AdminTransactionEntity>('Purchase');
  const [pendingDeleteTransaction, setPendingDeleteTransaction] = useState<AdminTransactionRecord | null>(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditAction, setAuditAction] = useState('ALL');
  const [auditProject, setAuditProject] = useState('ALL');
  const [auditEntity, setAuditEntity] = useState('ALL');

  const selectProject = useCallback(async (project: AdminProjectRecord) => {
    setSelectedProjectId(project.id);
    setProjectLoading(true);
    setError(null);
    try {
      setMaterialsLoading(true);
      const [intelligence, materials, transactionRegister] = await Promise.all([
        loadAdminProjectIntelligence(project.id),
        loadAdminProjectMaterials(project.id),
        loadAdminProjectTransactions(project.id),
      ]);
      setProjectIntelligence(intelligence);
      setProjectMaterials(materials);
      setTransactions(transactionRegister);
    } catch (err: any) {
      setProjectIntelligence(null);
      setProjectMaterials([]);
      setError(err?.message || 'Unable to load project intelligence.');
    } finally {
      setProjectLoading(false);
      setMaterialsLoading(false);
    }
  }, []);

  const refreshSelectedProject = useCallback(async (projectId: string) => {
    const [intelligence, materials, transactionRegister] = await Promise.all([
      loadAdminProjectIntelligence(projectId),
      loadAdminProjectMaterials(projectId),
      loadAdminProjectTransactions(projectId),
    ]);
    setProjectIntelligence(intelligence);
    setProjectMaterials(materials);
    setTransactions(transactionRegister);
  }, []);

  const confirmDeleteMaterial = useCallback(async () => {
    if (!pendingDeleteMaterial || !selectedProjectId) return;
    setDeletingMaterialId(pendingDeleteMaterial.id);
    setError(null);
    try {
      const result = await deleteAdminMaterial(
        selectedProjectId,
        pendingDeleteMaterial.id,
        admin.uid,
        admin.email,
      );
      setPendingDeleteMaterial(null);
      await refreshSelectedProject(selectedProjectId);
      setError(null);
      window.alert(
        `Material removed. Deleted ${result.deletedPurchases} purchase record(s), ${result.deletedUsage} usage record(s), and ${result.deletedTransport} linked transport record(s).`,
      );
    } catch (err: any) {
      setError(err?.message || 'Administrator material deletion failed.');
    } finally {
      setDeletingMaterialId(null);
    }
  }, [admin.email, admin.uid, pendingDeleteMaterial, refreshSelectedProject, selectedProjectId]);

  const confirmDeleteTransaction = useCallback(async () => {
    if (!pendingDeleteTransaction || !selectedProjectId) return;
    const record = pendingDeleteTransaction;
    setDeletingTransactionId(record.id);
    setError(null);

    try {
      switch (record.entityType) {
        case 'Purchase':
          await deleteAdminPurchase(selectedProjectId, record.id, admin.uid, admin.email);
          break;
        case 'MaterialUsage':
          await deleteAdminMaterialUsage(selectedProjectId, record.id, admin.uid, admin.email);
          break;
        case 'LabourPayment':
          await deleteAdminLabourPayment(selectedProjectId, record.id, admin.uid, admin.email);
          break;
        case 'Transportation':
          await deleteAdminTransportation(selectedProjectId, record.id, admin.uid, admin.email);
          break;
        case 'OtherExpense':
          await deleteAdminOtherExpense(selectedProjectId, record.id, admin.uid, admin.email);
          break;
        case 'WorkProgress':
          await deleteAdminWorkProgress(selectedProjectId, record.id, admin.uid, admin.email);
          break;
      }

      setPendingDeleteTransaction(null);
      await refreshSelectedProject(selectedProjectId);
      setError(null);
    } catch (err: any) {
      setError(err?.message || `Administrator ${record.entityType} deletion failed.`);
    } finally {
      setDeletingTransactionId(null);
    }
  }, [admin.email, admin.uid, pendingDeleteTransaction, refreshSelectedProject, selectedProjectId]);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      setData(await loadAdminOverview());
    } catch (err: any) {
      setError(err?.message || 'Unable to load administrator data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const filteredAuditEvents = useMemo(() => {
    const search = auditSearch.trim().toLowerCase();
    return data.auditEvents.filter((event) => {
      const matchesAction = auditAction === 'ALL' || event.action === auditAction;
      const matchesProject = auditProject === 'ALL' || event.projectId === auditProject;
      const matchesEntity = auditEntity === 'ALL' || event.entity === auditEntity;
      const haystack = [
        event.summary,
        event.userEmail,
        event.user,
        event.entity,
        event.entityId,
        event.projectId,
      ].join(' ').toLowerCase();
      return matchesAction && matchesProject && matchesEntity && (!search || haystack.includes(search));
    });
  }, [auditAction, auditEntity, auditProject, auditSearch, data.auditEvents]);

  const auditActions = useMemo(
    () => Array.from(new Set(data.auditEvents.map((event) => event.action).filter(Boolean))).sort(),
    [data.auditEvents],
  );

  const auditEntities = useMemo(
    () => Array.from(new Set(data.auditEvents.map((event) => event.entity).filter(Boolean))).sort(),
    [data.auditEvents],
  );

  const activeProjects = data.projects.filter((project) =>
    ['active', 'in progress'].includes(project.status.toLowerCase()),
  ).length;

  const totalBudgetKobo = data.projects.reduce((sum, project) => sum + project.budgetCapKobo, 0);

  const tabs: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: FolderKanban },
    { id: 'projects', label: 'Project Registry', icon: Building2 },
    { id: 'transactions', label: 'Transaction Governance', icon: ShieldAlert },
    { id: 'users', label: 'User Directory', icon: Users },
    { id: 'audit', label: 'Audit Centre', icon: FileClock },
  ];

  return (
    <div className="min-h-screen bg-[#F9F9FF] text-[#081B38]">
      <header className="sticky top-0 z-30 bg-[#F9F9FF]/95 backdrop-blur-xl border-b border-[#E8EDFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <AppLogo size={34} />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6B46C1]">
                Administrator Control Centre
              </p>
              <h1 className="text-sm sm:text-base font-bold tracking-tight truncate">
                Construction Project Tracker
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]">
              <ShieldCheck size={14} />
              <span className="text-[10px] font-bold">{admin.displayName || admin.email || 'Administrator'}</span>
            </div>
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="h-9 px-3 rounded-lg bg-[#000412] text-white text-xs font-semibold flex items-center gap-2"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-7">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#75777E]">Phase 2 • Foundation</p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">Administrator Control Centre</h2>
            <p className="mt-2 text-sm text-[#75777E] max-w-2xl">
              Cross-project visibility for registered users, construction workspaces, and the append-only audit stream.
              Administrative material removal is available only through an explicit, separately secured workflow.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load(false)}
            disabled={refreshing}
            className="self-start lg:self-auto h-10 px-3 rounded-xl bg-white border border-[#E8EDFF] text-[#081B38] text-xs font-bold flex items-center gap-2 shadow-xs"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-[#FF5449]/30 bg-[#FFDAD6] text-[#BA1A1A] px-4 py-3 text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto pb-1 mb-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 h-10 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  active ? 'bg-[#000412] text-white' : 'bg-white text-[#44474D] border border-[#E8EDFF] hover:bg-[#F1F3FF]'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="min-h-[360px] flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-9 h-9 mx-auto border-3 border-[#0F1E36] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold uppercase tracking-wider text-[#081B38]">Loading administrator data...</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <StatCard icon={Users} label="Registered Accounts" value={String(data.users.length)} detail="Profiles visible to the administrator" />
                  <StatCard icon={Building2} label="Project Workspaces" value={String(data.projects.length)} detail={`${activeProjects} active or in-progress`} />
                  <StatCard icon={CircleDollarSign} label="Budget Capacity" value={formatNairaCompact(totalBudgetKobo / 100)} detail="Sum of registered project budget caps" />
                  <StatCard icon={FileClock} label="Audit Events Loaded" value={String(data.auditEvents.length)} detail="Up to the current admin query limit" />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  <section className="bg-white border border-[#E8EDFF] rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-[#E8EDFF] flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold">Recent Projects</h3>
                        <p className="text-[11px] text-[#75777E] mt-0.5">Latest registered construction workspaces</p>
                      </div>
                      <button type="button" onClick={() => setActiveTab('projects')} className="text-[11px] font-bold text-[#6B46C1] flex items-center gap-1">
                        View registry <ChevronRight size={13} />
                      </button>
                    </div>
                    <ProjectTable
                      projects={data.projects.slice(0, 6)}
                      users={data.users}
                      selectedId={selectedProjectId}
                      onSelect={(project) => {
                        setActiveTab('projects');
                        void selectProject(project);
                      }}
                    />
                  </section>

                  <section className="bg-white border border-[#E8EDFF] rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-[#E8EDFF]">
                      <h3 className="text-sm font-bold">Recent Audit Activity</h3>
                      <p className="text-[11px] text-[#75777E] mt-0.5">Append-only activity across project workspaces</p>
                    </div>
                    <AuditTable events={data.auditEvents.slice(0, 8)} />
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="space-y-5">
                <section className="bg-white border border-[#E8EDFF] rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-[#E8EDFF]">
                    <h3 className="text-sm font-bold">Project Registry</h3>
                    <p className="text-[11px] text-[#75777E] mt-0.5">All project workspaces currently visible to the administrator. Select a project for live operational intelligence.</p>
                  </div>
                  <ProjectTable
                    projects={data.projects}
                    users={data.users}
                    selectedId={selectedProjectId}
                    onSelect={(project) => void selectProject(project)}
                  />
                </section>

                {selectedProjectId && (() => {
                  const project = data.projects.find((item) => item.id === selectedProjectId);
                  if (!project) return null;
                  const intelligence = projectIntelligence;
                  const spendPercent = intelligence && project.budgetCapKobo > 0
                    ? Math.min(999, (intelligence.actualSpendKobo / project.budgetCapKobo) * 100)
                    : 0;
                  return (
                    <section className="bg-white border border-[#E8EDFF] rounded-2xl overflow-hidden">
                      <div className="p-4 border-b border-[#E8EDFF]">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#75777E]">Project intelligence</p>
                            <h3 className="mt-1 text-lg font-bold">{project.name}</h3>
                            <p className="text-[11px] text-[#75777E]">{project.code || project.id} • {project.location || 'Location not recorded'}</p>
                          </div>
                          <span className={`inline-flex self-start px-2 py-1 rounded-full text-[10px] font-bold ${statusClasses(project.status)}`}>
                            {project.status}
                          </span>
                        </div>
                      </div>

                      {projectLoading ? (
                        <div className="py-12 text-center text-xs font-bold text-[#75777E]">Loading project intelligence...</div>
                      ) : intelligence ? (
                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                            <StatCard icon={CircleDollarSign} label="Actual Spend" value={formatNairaCompact(intelligence.actualSpendKobo / 100)} detail={`${spendPercent.toFixed(1)}% of budget cap`} />
                            <StatCard icon={WalletCards} label="Cash Paid" value={formatNairaCompact(intelligence.cashPaidKobo / 100)} detail="Recorded cash outflow" />
                            <StatCard icon={CircleAlert} label="Outstanding" value={formatNairaCompact(intelligence.outstandingKobo / 100)} detail="Supplier + contractor balances" />
                            <StatCard icon={Percent} label="Completion" value={`${intelligence.completionPercent.toFixed(1)}%`} detail={`${intelligence.workItems} work item${intelligence.workItems === 1 ? '' : 's'}`} />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                            {[
                              ['Materials', intelligence.materialsKobo, Banknote],
                              ['Labour', intelligence.labourKobo, BriefcaseBusiness],
                              ['Transportation', intelligence.transportationKobo, Building2],
                              ['Other Expenses', intelligence.otherExpensesKobo, Activity],
                            ].map(([label, value, Icon]) => (
                              <div key={String(label)} className="rounded-xl border border-[#E8EDFF] bg-[#F9F9FF] p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#75777E]">{String(label)}</span>
                                  <Icon size={15} className="text-[#6B46C1]" />
                                </div>
                                <p className="mt-2 text-sm font-bold text-[#081B38]">{formatNairaCompact(Number(value) / 100)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 text-center text-xs text-[#75777E]">No operational records are available for this project yet.</div>
                      )}

                      <section className="border-t border-[#E8EDFF]">
                        <div className="p-4 border-b border-[#E8EDFF] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold">Material Registry</h4>
                            <p className="text-[11px] text-[#75777E] mt-0.5">
                              Administrative view of materials and their transaction history.
                            </p>
                          </div>
                          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#FFF7ED] text-[#9A3412] border border-[#FED7AA]">
                            <ShieldAlert size={13} />
                            <span className="text-[10px] font-bold">Destructive actions are audited</span>
                          </div>
                        </div>

                        {materialsLoading ? (
                          <div className="py-10 text-center text-xs font-bold text-[#75777E]">Loading material registry...</div>
                        ) : projectMaterials.length === 0 ? (
                          <div className="py-10 text-center text-xs text-[#75777E]">No materials are registered in this project.</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[860px] text-left">
                              <thead>
                                <tr className="border-b border-[#E8EDFF] text-[10px] uppercase tracking-wider text-[#75777E]">
                                  <th className="px-4 py-3 font-bold">Material</th>
                                  <th className="px-4 py-3 font-bold">Stock</th>
                                  <th className="px-4 py-3 font-bold">Purchases</th>
                                  <th className="px-4 py-3 font-bold">Usage</th>
                                  <th className="px-4 py-3 font-bold text-right">Acquisition</th>
                                  <th className="px-4 py-3 font-bold text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {projectMaterials.map((material) => {
                                  const hasHistory = material.purchaseCount > 0 || material.usageCount > 0 || material.totalPurchased > 0 || material.totalUsed > 0;
                                  return (
                                    <tr key={material.id} className="border-b border-[#F0F2FA] last:border-0">
                                      <td className="px-4 py-3">
                                        <div className="font-semibold text-sm text-[#081B38]">{material.name}</div>
                                        <div className="text-[10px] text-[#75777E]">{material.category} • {material.unit}</div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="text-xs font-bold text-[#081B38]">{material.remaining} {material.unit}</div>
                                        <div className="text-[10px] text-[#75777E]">{material.totalPurchased} purchased • {material.totalUsed} used</div>
                                      </td>
                                      <td className="px-4 py-3 text-xs font-semibold">{material.purchaseCount}</td>
                                      <td className="px-4 py-3 text-xs font-semibold">{material.usageCount}</td>
                                      <td className="px-4 py-3 text-right text-xs font-mono font-bold">{formatNairaCompact(material.totalCostKobo / 100)}</td>
                                      <td className="px-4 py-3 text-right">
                                        <button
                                          type="button"
                                          onClick={() => setPendingDeleteMaterial(material)}
                                          disabled={deletingMaterialId !== null}
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#FFF1F2] text-[#BE123C] border border-[#FECDD3] text-[10px] font-bold hover:bg-[#FFE4E6] disabled:opacity-50"
                                          title={hasHistory ? 'Remove material and all linked transaction history' : 'Remove unused material'}
                                        >
                                          <Trash2 size={13} />
                                          Remove
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    </section>
                  );
                })()}
              </div>
            )}

            {activeTab === 'transactions' && (
              <div className="space-y-5">
                <section className="bg-white border border-[#E8EDFF] rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-[#E8EDFF]">
                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#75777E]">Phase 2.3</p>
                        <h3 className="mt-1 text-sm font-bold">Transaction Governance</h3>
                        <p className="text-[11px] text-[#75777E] mt-0.5 max-w-2xl">
                          Recorded financial and operational history is now protected from ordinary deletion. Corrections remain editable; permanent removal is an administrator action with a durable intent and audit event.
                        </p>
                      </div>
                      <select
                        value={selectedProjectId || ''}
                        onChange={(event) => {
                          const project = data.projects.find((item) => item.id === event.target.value);
                          if (project) void selectProject(project);
                        }}
                        className="h-9 min-w-[220px] px-3 rounded-lg border border-[#E8EDFF] bg-[#F9F9FF] text-xs outline-none"
                      >
                        <option value="" disabled>Select project</option>
                        {data.projects.map((project) => (
                          <option key={project.id} value={project.id}>{project.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {!selectedProjectId ? (
                    <div className="py-16 text-center text-sm text-[#75777E]">Select a project to inspect governed transaction records.</div>
                  ) : (
                    <>
                      <div className="p-4 border-b border-[#E8EDFF]">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
                          {([
                            ['Purchase', 'purchases', 'Purchases'],
                            ['MaterialUsage', 'usage', 'Material usage'],
                            ['LabourPayment', 'labourPayments', 'Labour payments'],
                            ['Transportation', 'transportation', 'Transportation'],
                            ['OtherExpense', 'otherExpenses', 'Other expenses'],
                            ['WorkProgress', 'workProgress', 'Work progress'],
                          ] as const).map(([entity, key, label]) => {
                            const count = transactions[key].length;
                            return (
                              <button
                                key={entity}
                                type="button"
                                onClick={() => setTransactionEntity(entity)}
                                className={`rounded-xl border px-3 py-2 text-left ${transactionEntity === entity ? 'border-[#0F1E36] bg-[#F1F3FF]' : 'border-[#E8EDFF] bg-white'}`}
                              >
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[#75777E]">{label}</div>
                                <div className="mt-1 text-lg font-bold text-[#081B38]">{count}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="p-4 bg-[#FFF7ED] border-b border-[#FED7AA] flex items-start gap-2">
                        <ShieldAlert size={15} className="text-[#9A3412] mt-0.5 shrink-0" />
                        <div className="text-[11px] text-[#9A3412]">
                          <strong>Governance rule:</strong> deletion of a recorded transaction is not an ordinary correction. Use the existing edit workflow for corrections. Use <strong>Remove</strong> here only when the historical record itself must be permanently eliminated.
                        </div>
                      </div>

                      {transactionsLoading ? (
                        <div className="py-12 text-center text-xs font-bold text-[#75777E]">Loading governed transaction records...</div>
                      ) : (
                        <TransactionTable
                          records={
                            transactionEntity === 'Purchase' ? transactions.purchases :
                            transactionEntity === 'MaterialUsage' ? transactions.usage :
                            transactionEntity === 'LabourPayment' ? transactions.labourPayments :
                            transactionEntity === 'Transportation' ? transactions.transportation :
                            transactionEntity === 'OtherExpense' ? transactions.otherExpenses :
                            transactions.workProgress
                          }
                          onDelete={(record) => setPendingDeleteTransaction(record)}
                          deletingId={deletingTransactionId}
                        />
                      )}
                    </>
                  )}
                </section>
              </div>
            )}

            {activeTab === 'users' && (
              <section className="bg-white border border-[#E8EDFF] rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-[#E8EDFF]">
                  <h3 className="text-sm font-bold">User Directory</h3>
                  <p className="text-[11px] text-[#75777E] mt-0.5">Firestore profiles and their current application roles.</p>
                </div>
                <UserTable users={data.users} />
              </section>
            )}

            {activeTab === 'audit' && (
              <section className="bg-white border border-[#E8EDFF] rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-[#E8EDFF]">
                  <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold">Audit Centre</h3>
                      <p className="text-[11px] text-[#75777E] mt-0.5">
                        Append-only activity across all visible projects. Use filters to isolate a project, action, or record type.
                      </p>
                    </div>
                    <div className="text-[10px] font-bold text-[#75777E]">
                      {filteredAuditEvents.length} of {data.auditEvents.length} events
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <input
                      value={auditSearch}
                      onChange={(event) => setAuditSearch(event.target.value)}
                      placeholder="Search audit activity..."
                      className="h-9 px-3 rounded-lg border border-[#E8EDFF] bg-[#F9F9FF] text-xs outline-none focus:border-[#6B46C1]"
                    />
                    <select
                      value={auditAction}
                      onChange={(event) => setAuditAction(event.target.value)}
                      className="h-9 px-3 rounded-lg border border-[#E8EDFF] bg-[#F9F9FF] text-xs outline-none"
                    >
                      <option value="ALL">All actions</option>
                      {auditActions.map((action) => <option key={action} value={action}>{action}</option>)}
                    </select>
                    <select
                      value={auditEntity}
                      onChange={(event) => setAuditEntity(event.target.value)}
                      className="h-9 px-3 rounded-lg border border-[#E8EDFF] bg-[#F9F9FF] text-xs outline-none"
                    >
                      <option value="ALL">All record types</option>
                      {auditEntities.map((entity) => <option key={entity} value={entity}>{entity}</option>)}
                    </select>
                    <select
                      value={auditProject}
                      onChange={(event) => setAuditProject(event.target.value)}
                      className="h-9 px-3 rounded-lg border border-[#E8EDFF] bg-[#F9F9FF] text-xs outline-none"
                    >
                      <option value="ALL">All projects</option>
                      {data.projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </select>
                  </div>
                  {(auditSearch || auditAction !== 'ALL' || auditEntity !== 'ALL' || auditProject !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuditSearch('');
                        setAuditAction('ALL');
                        setAuditEntity('ALL');
                        setAuditProject('ALL');
                      }}
                      className="mt-2 text-[10px] font-bold text-[#6B46C1]"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
                <AuditTable events={filteredAuditEvents} />
              </section>
            )}
          </>
        )}
      </main>

      {pendingDeleteTransaction && (
        <div className="fixed inset-0 z-50 bg-[#000412]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-[#E8EDFF] shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-[#E8EDFF] flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF1F2] text-[#BE123C] flex items-center justify-center shrink-0">
                  <Trash2 size={18} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#BE123C]">Permanent administrator action</p>
                  <h3 className="mt-1 text-lg font-bold text-[#081B38]">Remove {pendingDeleteTransaction.title}?</h3>
                </div>
              </div>
              <button type="button" onClick={() => setPendingDeleteTransaction(null)} className="w-8 h-8 rounded-lg hover:bg-[#F1F3FF] flex items-center justify-center text-[#75777E]">
                <X size={17} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-[#44474D]">
                This permanently removes the {pendingDeleteTransaction.entityType} record from the selected project.
              </p>
              <div className="rounded-xl border border-[#FED7AA] bg-[#FFF7ED] p-3 text-xs text-[#9A3412]">
                <strong>Historical impact:</strong>{' '}
                {pendingDeleteTransaction.entityType === 'Purchase'
                  ? `The purchase will be removed, linked transport history (${pendingDeleteTransaction.linkedCount || 0} record(s)) will be removed, and the material inventory will be recalculated.`
                  : pendingDeleteTransaction.entityType === 'MaterialUsage'
                    ? 'The material usage record will be removed and the referenced material inventory will be recalculated.'
                    : pendingDeleteTransaction.entityType === 'LabourPayment'
                      ? 'The payment will be removed and the referenced contractor balance will be recalculated.'
                      : 'The selected historical record will be removed and project aggregates will recalculate from the remaining records.'}
              </div>
              <p className="text-[11px] text-[#75777E]">
                {pendingDeleteTransaction.amountKobo > 0 ? `Recorded amount: ${formatNairaCompact(pendingDeleteTransaction.amountKobo / 100)}. ` : ''}
                This action is append-only audited and cannot be undone from the application.
              </p>
            </div>
            <div className="p-5 pt-0 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDeleteTransaction(null)} disabled={deletingTransactionId !== null} className="h-10 px-4 rounded-xl border border-[#E8EDFF] bg-white text-xs font-bold text-[#44474D]">
                Cancel
              </button>
              <button type="button" onClick={() => void confirmDeleteTransaction()} disabled={deletingTransactionId !== null} className="h-10 px-4 rounded-xl bg-[#BE123C] text-white text-xs font-bold flex items-center gap-2 disabled:opacity-60">
                <Trash2 size={14} />
                {deletingTransactionId ? 'Removing...' : 'Confirm Permanent Removal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteMaterial && (
        <div className="fixed inset-0 z-50 bg-[#000412]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-[#E8EDFF] shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-[#E8EDFF] flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF1F2] text-[#BE123C] flex items-center justify-center shrink-0">
                  <Trash2 size={18} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#BE123C]">Permanent administrator action</p>
                  <h3 className="mt-1 text-lg font-bold text-[#081B38]">Remove {pendingDeleteMaterial.name}?</h3>
                </div>
              </div>
              <button type="button" onClick={() => setPendingDeleteMaterial(null)} className="w-8 h-8 rounded-lg hover:bg-[#F1F3FF] flex items-center justify-center text-[#75777E]">
                <X size={17} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-[#44474D]">
                This action permanently removes the material from the selected project.
              </p>
              <div className="rounded-xl border border-[#FED7AA] bg-[#FFF7ED] p-3 text-xs text-[#9A3412]">
                <strong>Linked history will also be removed:</strong> {pendingDeleteMaterial.purchaseCount} purchase record(s), {pendingDeleteMaterial.usageCount} usage record(s), and any transport records linked to those purchases.
              </div>
              <p className="text-[11px] text-[#75777E]">
                This cannot be undone from the application. The administrator action will be recorded in the append-only audit trail.
              </p>
            </div>
            <div className="p-5 pt-0 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDeleteMaterial(null)} disabled={deletingMaterialId !== null} className="h-10 px-4 rounded-xl border border-[#E8EDFF] bg-white text-xs font-bold text-[#44474D]">
                Cancel
              </button>
              <button type="button" onClick={() => void confirmDeleteMaterial()} disabled={deletingMaterialId !== null} className="h-10 px-4 rounded-xl bg-[#BE123C] text-white text-xs font-bold flex items-center gap-2 disabled:opacity-60">
                <Trash2 size={14} />
                {deletingMaterialId ? 'Removing...' : 'Confirm Permanent Removal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
