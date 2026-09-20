import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  ChevronRight,
  CircleDollarSign,
  FileClock,
  FolderKanban,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { AdminProfile } from '../services/adminAuth';
import {
  AdminAuditRecord,
  AdminOverview,
  AdminProjectRecord,
  AdminUserRecord,
  loadAdminOverview,
} from '../services/adminData';
import { formatDate, formatNairaCompact } from '../utils/formatters';
import { AppLogo } from '../components/common/AppLogo';

type AdminTab = 'overview' | 'projects' | 'users' | 'audit';

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

function ProjectTable({ projects, users }: { projects: AdminProjectRecord[]; users: AdminUserRecord[] }) {
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
            <tr key={project.id} className="border-b border-[#F0F2FA] last:border-0 hover:bg-[#F9F9FF]">
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

function AuditTable({ events }: { events: AdminAuditRecord[] }) {
  if (events.length === 0) {
    return (
      <div className="py-14 text-center text-sm text-[#75777E]">
        No audit events are available yet.
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

  const activeProjects = data.projects.filter((project) =>
    ['active', 'in progress'].includes(project.status.toLowerCase()),
  ).length;

  const totalBudgetKobo = data.projects.reduce((sum, project) => sum + project.budgetCapKobo, 0);

  const tabs: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: FolderKanban },
    { id: 'projects', label: 'Project Registry', icon: Building2 },
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
              This first slice is read-only; administrative mutations will be introduced through explicit, separately secured workflows.
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
                    <ProjectTable projects={data.projects.slice(0, 6)} users={data.users} />
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
              <section className="bg-white border border-[#E8EDFF] rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-[#E8EDFF]">
                  <h3 className="text-sm font-bold">Project Registry</h3>
                  <p className="text-[11px] text-[#75777E] mt-0.5">All project workspaces currently visible to the administrator.</p>
                </div>
                <ProjectTable projects={data.projects} users={data.users} />
              </section>
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
                  <h3 className="text-sm font-bold">Audit Centre</h3>
                  <p className="text-[11px] text-[#75777E] mt-0.5">Recent append-only audit events across all visible projects.</p>
                </div>
                <AuditTable events={data.auditEvents} />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};
