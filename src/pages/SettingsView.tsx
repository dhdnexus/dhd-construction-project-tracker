import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  Check,
  ShieldCheck,
  Activity,
  User,
  Building,
  Plus,
  Lock,
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ProjectSettings, AuditEvent, UserProfile } from '../types';
import { formatNaira, formatRelativeTime } from '../utils/formatters';
import { ConstructionTrackerService } from '../services/storage';

interface SettingsViewProps {
  project: ProjectSettings;
  projects?: ProjectSettings[];
  activeProjectId?: string;
  userProfile?: UserProfile;
  auditEvents?: AuditEvent[];
  onUpdateProject: (updates: Partial<ProjectSettings>) => void;
  onSwitchProject?: (id: string) => Promise<void>;
  onCreateProject?: (data: Partial<ProjectSettings>) => Promise<ProjectSettings>;
  onDeleteProject?: (id: string) => Promise<void>;
  onResetSeedData: () => void;
  onClearAllData: () => void;
  onOpenAuthModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  project,
  projects = [],
  activeProjectId = '',
  userProfile,
  auditEvents = [],
  onUpdateProject,
  onSwitchProject,
  onCreateProject,
  onDeleteProject,
  onResetSeedData,
  onClearAllData,
  onOpenAuthModal,
}) => {
  const [name, setName] = useState(project?.name || '');
  const [code, setCode] = useState(project?.code || '');
  const [siteAddress, setSiteAddress] = useState(project?.siteAddress || project?.location || '');
  const [budgetCap, setBudgetCap] = useState<number | string>(project?.budgetCap || 27000000);
  const [handoverDate, setHandoverDate] = useState(project?.handoverDate || '');
  const [projectManager, setProjectManager] = useState(project?.projectManager || '');
  const [activeArtisans, setActiveArtisans] = useState<number | string>(project?.activeArtisans || 0);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  // New project creation state in Settings
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjCode, setNewProjCode] = useState('');
  const [newProjBudget, setNewProjBudget] = useState('25000000');
  const [creatingProject, setCreatingProject] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setCode(project.code || '');
      setSiteAddress(project.siteAddress || project.location || '');
      setBudgetCap(project.budgetCap || 27000000);
      setHandoverDate(project.handoverDate || '');
      setProjectManager(project.projectManager || '');
      setActiveArtisans(project.activeArtisans || 0);
    }
  }, [project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProject({
      name,
      code,
      siteAddress,
      location: siteAddress,
      budgetCap: typeof budgetCap === 'number' ? budgetCap : parseFloat(String(budgetCap)) || 0,
      handoverDate,
      projectManager,
      activeArtisans: typeof activeArtisans === 'number' ? activeArtisans : parseInt(String(activeArtisans)) || 0,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim() || !onCreateProject) return;
    setCreatingProject(true);
    try {
      await onCreateProject({
        name: newProjName.trim(),
        code: newProjCode.trim() || `#PRJ-${Math.floor(100 + Math.random() * 900)}`,
        budgetCap: parseFloat(newProjBudget) || 25000000,
        siteAddress: 'Lagos, Nigeria',
      });
      setNewProjName('');
      setNewProjCode('');
      setShowNewProjectForm(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to create project.');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleDeleteProject = async (p: ProjectSettings) => {
    if (!onDeleteProject) return;
    if (!userProfile?.uid) {
      alert('An authenticated project owner is required to delete a project.');
      return;
    }
    if (!confirm(`Delete project "${p.name}"? This removes all its operational records from Firestore.`)) {
      return;
    }

    setDeletingProjectId(p.id);
    try {
      const intentId = `delete_intent_${p.id}`;
      const intentRef = doc(db, 'auditEvents', intentId);
      const existingIntent = await getDoc(intentRef);

      if (!existingIntent.exists()) {
        const now = new Date().toISOString();
        const intentEvent: AuditEvent = {
          id: intentId,
          timestamp: now,
          action: 'CREATE',
          entityType: 'ProjectDeletionIntent',
          entity: 'System',
          entityId: p.id,
          user: userProfile.displayName || userProfile.email || 'Site User',
          userEmail: userProfile.email || undefined,
          ownerId: p.ownerId || userProfile.uid,
          projectId: p.id,
          summary: `Deletion initiated for project: ${p.name} (${p.code})`,
          details: 'Durable deletion intent recorded before project purge.',
        };
        await setDoc(intentRef, intentEvent);
      }

      await onDeleteProject(p.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to authorize or delete project. No project deletion was confirmed.');
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleExportJSON = () => {
    const jsonString = ConstructionTrackerService.exportDatabaseJSON();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonStr = event.target?.result as string;
        const success = await ConstructionTrackerService.importDatabaseJSON(jsonStr);
        if (success) {
          setImportStatus('Backup restored successfully into Firestore.');
          setTimeout(() => setImportStatus(null), 4000);
        } else {
          alert('Failed to parse or restore database JSON. Please verify the file.');
        }
      } catch {
        alert('Failed to read backup file.');
      }
    };
    reader.readAsText(file);
  };

  const eventsList = auditEvents.length > 0 ? auditEvents : ConstructionTrackerService.getAuditEvents();
  const isAuthUser = userProfile && !userProfile.isAnonymous && !!userProfile.email;

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-[#E0E8FF] text-[#0F1E36] text-[11px] font-bold tracking-wider uppercase">
              Project Parameters
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#081B38] tracking-tight mt-1">
            Site Settings & Configuration
          </h1>
          <p className="text-xs text-[#75777E] mt-0.5">
            Manage project parameters, currency, financial ceilings, multi-project workspaces and database backups
          </p>
        </div>

        <div className="w-10 h-10 rounded-2xl bg-[#F1F3FF] text-[#081B38] flex items-center justify-center">
          <SettingsIcon size={20} />
        </div>
      </div>

      {/* Account & Multi-Project Workspace Card */}
      <div className="bg-white rounded-2xl border border-[#E8EDFF] p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E8EDFF]">
          <div>
            <h2 className="text-sm font-bold text-[#081B38] uppercase tracking-wider flex items-center gap-2">
              <Building size={16} className="text-[#0F1E36]" />
              Multi-Project Workspaces ({projects.length || 1})
            </h2>
            <p className="text-xs text-[#75777E] mt-0.5">
              Switch between isolated construction sites or establish a new project ledger
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onOpenAuthModal && (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="h-9 px-3 rounded-xl border border-[#E8EDFF] hover:bg-[#F1F3FF] text-xs font-bold text-[#081B38] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <User size={14} />
                <span>{isAuthUser ? userProfile.email : 'Sign In / Account'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowNewProjectForm(!showNewProjectForm)}
              className="h-9 px-3 rounded-xl bg-[#000412] hover:bg-[#0F1E36] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>New Site</span>
            </button>
          </div>
        </div>

        {/* New Project Inline Form */}
        {showNewProjectForm && (
          <form onSubmit={handleCreateProjectSubmit} className="p-4 rounded-xl bg-[#F9F9FF] border border-[#E8EDFF] space-y-3">
            <h3 className="text-xs font-bold text-[#081B38] uppercase tracking-wider">Initialize New Site Workspace</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[#75777E] uppercase mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  placeholder="e.g. Lekki Phase 2 Site"
                  className="w-full h-9 px-3 text-xs bg-white border border-[#C5C6CE] rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#75777E] uppercase mb-1">Project Code</label>
                <input
                  type="text"
                  value={newProjCode}
                  onChange={(e) => setNewProjCode(e.target.value)}
                  placeholder="e.g. #LK2-885"
                  className="w-full h-9 px-3 text-xs font-mono bg-white border border-[#C5C6CE] rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#75777E] uppercase mb-1">Budget Cap (₦)</label>
                <input
                  type="number"
                  value={newProjBudget}
                  onChange={(e) => setNewProjBudget(e.target.value)}
                  placeholder="25,000,000"
                  className="w-full h-9 px-3 text-xs font-mono bg-white border border-[#C5C6CE] rounded-lg outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowNewProjectForm(false)}
                className="h-8 px-3 text-xs text-[#75777E] hover:text-[#081B38] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingProject}
                className="h-8 px-4 bg-[#000412] hover:bg-[#0F1E36] text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                {creatingProject ? 'Creating...' : 'Create Site'}
              </button>
            </div>
          </form>
        )}

        {/* Existing Projects List */}
        {projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map((p) => {
              const isActive = p.id === (activeProjectId || project.id);
              const isDeleting = deletingProjectId === p.id;
              return (
                <div
                  key={p.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                    isActive
                      ? 'border-[#081B38] bg-[#F1F3FF]/70 shadow-xs'
                      : 'border-[#E8EDFF] bg-white hover:border-[#081B38]/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#081B38] truncate">{p.name}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white text-[#75777E] border border-[#E8EDFF]">
                        {p.code}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#75777E] mt-0.5">
                      Budget Cap: <span className="font-semibold text-[#081B38]">{formatNaira(p.budgetCap)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {isActive ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]">
                        Active
                      </span>
                    ) : (
                      onSwitchProject && (
                        <button
                          type="button"
                          onClick={() => onSwitchProject(p.id)}
                          className="h-7 px-2.5 text-[11px] font-bold text-[#081B38] bg-white hover:bg-[#E8EDFF] border border-[#E8EDFF] rounded-lg transition-colors cursor-pointer"
                        >
                          Switch
                        </button>
                      )
                    )}

                    {onDeleteProject && (
                      <button
                        type="button"
                        onClick={() => handleDeleteProject(p)}
                        disabled={deletingProjectId !== null}
                        className="w-7 h-7 flex items-center justify-center text-[#75777E] hover:text-[#BA1A1A] hover:bg-[#FFDAD6] rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title={isDeleting ? 'Deleting project...' : 'Delete project'}
                        aria-label={isDeleting ? `Deleting ${p.name}` : `Delete ${p.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cloud Persistence Status Card */}
      <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCFCE7] text-[#15803D] flex items-center justify-center shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#081B38]">Cloud Database: Firebase Firestore & Auth</h2>
              <span className="px-2 py-0.5 bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] rounded-full text-[10px] font-bold">
                Online & Synchronized
              </span>
            </div>
            <p className="text-xs text-[#75777E] mt-0.5">
              Multi-project tenant isolation with Firestore security rules and real-time listeners.
            </p>
          </div>
        </div>
        <div className="font-mono text-xs text-[#75777E] bg-[#F9F9FF] px-3 py-1.5 rounded-xl border border-[#E8EDFF] self-start sm:self-auto">
          Database: <span className="font-bold text-[#081B38]">gen-lang-client-0458621800</span>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-[#DCFCE7] text-[#15803D] rounded-xl flex items-center gap-2 border border-[#BBF7D0] text-xs font-bold animate-in fade-in">
          <Check size={16} />
          <span>Project settings successfully updated and saved to Firestore!</span>
        </div>
      )}

      {importStatus && (
        <div className="p-4 bg-[#DCFCE7] text-[#15803D] rounded-xl flex items-center gap-2 border border-[#BBF7D0] text-xs font-bold animate-in fade-in">
          <Check size={16} />
          <span>{importStatus}</span>
        </div>
      )}

      {/* Form Card for Active Project */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E8EDFF] p-6 shadow-xs space-y-5">
        <h2 className="text-sm font-bold text-[#081B38] uppercase tracking-wider pb-3 border-b border-[#E8EDFF]">
          Active Site Parameters ({project.name})
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1.5">
              Project Title
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#081B38] focus:bg-white rounded-xl outline-none font-semibold text-[#081B38]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1.5">
              Project Code / Lot #
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#081B38] focus:bg-white rounded-xl outline-none font-semibold text-[#081B38]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1.5">
            Physical Site Address
          </label>
          <input
            type="text"
            required
            value={siteAddress}
            onChange={(e) => setSiteAddress(e.target.value)}
            className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#081B38] focus:bg-white rounded-xl outline-none text-[#081B38]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1.5">
              Budget Cap Ceiling (₦)
            </label>
            <input
              type="number"
              required
              min="0"
              value={budgetCap}
              onChange={(e) => setBudgetCap(parseFloat(e.target.value) || 0)}
              className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#081B38] focus:bg-white rounded-xl outline-none font-bold text-[#081B38]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1.5">
              Target Handover Date
            </label>
            <input
              type="date"
              required
              value={handoverDate}
              onChange={(e) => setHandoverDate(e.target.value)}
              className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1.5">
              Active Artisans on Site
            </label>
            <input
              type="number"
              min="0"
              required
              value={activeArtisans}
              onChange={(e) => setActiveArtisans(parseInt(e.target.value) || 0)}
              className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#081B38] focus:bg-white rounded-xl outline-none font-bold text-[#081B38]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1.5">
              Lead Project Manager
            </label>
            <input
              type="text"
              required
              value={projectManager}
              onChange={(e) => setProjectManager(e.target.value)}
              className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#081B38] focus:bg-white rounded-xl outline-none text-[#081B38]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1.5">
              Default Project Currency
            </label>
            <input
              type="text"
              disabled
              value="Nigerian Naira (₦ / NGN)"
              className="w-full h-11 px-3.5 text-sm bg-[#F1F3FF] border border-[#C5C6CE] rounded-xl outline-none text-[#75777E] font-medium"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-[#E8EDFF] flex justify-end">
          <button
            type="submit"
            className="h-11 px-6 bg-[#000412] hover:bg-[#0F1E36] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Save size={15} />
            <span>Save Active Site Configuration</span>
          </button>
        </div>
      </form>

      {/* Database & Data Integrity Card */}
      <div className="bg-white rounded-2xl border border-[#E8EDFF] p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-[#081B38] uppercase tracking-wider pb-3 border-b border-[#E8EDFF]">
          Data Custody & Backups
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#F9F9FF] border border-[#E8EDFF]">
          <div>
            <h3 className="text-sm font-bold text-[#081B38]">Export Site Database Backup</h3>
            <p className="text-xs text-[#75777E]">Download a structured JSON snapshot of all purchases, payments, materials and logs.</p>
          </div>
          <button
            onClick={handleExportJSON}
            className="h-10 px-4 bg-[#0F1E36] hover:bg-[#1A2B49] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            <Download size={15} />
            <span>Export JSON Snapshot</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#F9F9FF] border border-[#E8EDFF]">
          <div>
            <h3 className="text-sm font-bold text-[#081B38]">Restore from Backup File</h3>
            <p className="text-xs text-[#75777E]">Upload previously saved JSON backup to replace existing records in Cloud Firestore.</p>
          </div>
          <label className="h-10 px-4 bg-white border border-[#C5C6CE] hover:bg-[#F1F3FF] text-[#081B38] text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer">
            <Upload size={15} />
            <span>Restore JSON File</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A]">
          <div>
            <h3 className="text-sm font-bold text-[#B45309]">Load Demo & Benchmark Finishing Dataset</h3>
            <p className="text-xs text-[#92400E]">Populates realistic sample data (tiles, screeding, POP, haulage) into this site workspace.</p>
          </div>
          <button
            onClick={() => {
              if (confirm('Load sample demo data into this project? Any existing records with matching IDs will be overwritten.')) {
                onResetSeedData();
              }
            }}
            className="h-10 px-4 bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            <RotateCcw size={15} />
            <span>Load Demo Data</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#FFDAD6]/40 border border-[#FFDAD6]">
          <div>
            <h3 className="text-sm font-bold text-[#BA1A1A]">Clear All Site Transactions</h3>
            <p className="text-xs text-[#75777E]">Wipes all logs in this project to start clean for a brand new real estate development.</p>
          </div>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to wipe all transaction records in this project? This cannot be undone.')) {
                onClearAllData();
              }
            }}
            className="h-10 px-4 bg-[#BA1A1A] hover:bg-[#93000A] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            <Trash2 size={15} />
            <span>Wipe All Data</span>
          </button>
        </div>
      </div>

      {/* Historical Audit Trail Card */}
      <div className="bg-white rounded-2xl border border-[#E8EDFF] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E8EDFF]">
          <div>
            <h2 className="text-sm font-bold text-[#081B38] uppercase tracking-wider flex items-center gap-2">
              <Activity size={16} className="text-[#0F1E36]" />
              Site Change Audit Trail
            </h2>
            <p className="text-xs text-[#75777E] mt-0.5">
              Historical ledger of site acquisitions, stock usages, disbursements and system operations
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-[#75777E] bg-[#F1F3FF] px-2.5 py-1 rounded-lg">
            {eventsList.length} Events Logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E8EDFF] bg-[#F1F3FF] text-[#75777E] font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3">Timestamp</th>
                <th className="p-3">User</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
                <th className="p-3">Summary of Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EDFF]">
              {eventsList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-[#75777E]">
                    No audit events recorded yet.
                  </td>
                </tr>
              ) : (
                eventsList.slice(0, 25).map((evt) => (
                  <tr key={evt.id} className="hover:bg-[#F9F9FF] transition-colors">
                    <td className="p-3 font-mono text-[#75777E] whitespace-nowrap text-[11px]">
                      {formatRelativeTime(evt.timestamp)}
                    </td>
                    <td className="p-3 font-medium text-[#081B38] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="text-[#75777E]" />
                        <span>{evt.userEmail || evt.user || 'Engineer'}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          evt.action === 'CREATE'
                            ? 'bg-[#DCFCE7] text-[#15803D]'
                            : evt.action === 'UPDATE'
                            ? 'bg-[#E0E8FF] text-[#0F1E36]'
                            : evt.action === 'DELETE'
                            ? 'bg-[#FFDAD6] text-[#BA1A1A]'
                            : 'bg-[#FFFBEB] text-[#D97706]'
                        }`}
                      >
                        {evt.action}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-[#081B38]">{evt.entityType || evt.entity}</td>
                    <td className="p-3 text-[#44474D] max-w-md truncate">{evt.details || evt.summary}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
