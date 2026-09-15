import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  Check,
  AlertCircle,
  Database,
  Building,
  Calendar,
  DollarSign,
  ShieldCheck,
  Activity,
  User,
  Clock,
} from 'lucide-react';
import { ProjectSettings, AuditEvent } from '../types';
import { formatNaira, formatDate, formatRelativeTime } from '../utils/formatters';
import { ConstructionTrackerService } from '../services/storage';

interface SettingsViewProps {
  project: ProjectSettings;
  auditEvents?: AuditEvent[];
  onUpdateProject: (updates: Partial<ProjectSettings>) => void;
  onResetSeedData: () => void;
  onClearAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  project,
  auditEvents = [],
  onUpdateProject,
  onResetSeedData,
  onClearAllData,
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
      budgetCap: typeof budgetCap === 'number' ? budgetCap : parseFloat(String(budgetCap)) || 0,
      handoverDate,
      projectManager,
      activeArtisans: typeof activeArtisans === 'number' ? activeArtisans : parseInt(String(activeArtisans)) || 0,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExportJSON = () => {
    const jsonString = ConstructionTrackerService.exportDatabaseJSON();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dhd_construction_backup_${new Date().toISOString().split('T')[0]}.json`;
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
      } catch (err) {
        alert('Failed to read backup file.');
      }
    };
    reader.readAsText(file);
  };

  const eventsList = auditEvents.length > 0 ? auditEvents : ConstructionTrackerService.getAuditEvents();

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
            Manage project parameters, currency, financial ceilings and database backups
          </p>
        </div>

        <div className="w-10 h-10 rounded-2xl bg-[#F1F3FF] text-[#081B38] flex items-center justify-center">
          <SettingsIcon size={20} />
        </div>
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
              Authoritative multi-client synchronization with ownership security rules and real-time listeners.
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

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E8EDFF] p-6 shadow-xs space-y-5">
        <h2 className="text-sm font-bold text-[#081B38] uppercase tracking-wider pb-3 border-b border-[#E8EDFF]">
          Site Identity & Delivery Parameters
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
              className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none font-semibold text-[#081B38]"
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
              className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none font-semibold text-[#081B38]"
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
            className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
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
              value={budgetCap}
              onChange={(e) => setBudgetCap(parseFloat(e.target.value) || 0)}
              className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none font-bold text-[#081B38]"
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
              className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
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
              className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
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
              className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
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
            <span>Save Configuration</span>
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
            <h3 className="text-sm font-bold text-[#B45309]">Reset to Initial Finishing Demo Data</h3>
            <p className="text-xs text-[#92400E]">Restores realistic finishing site data (tiles, screeding, POP, haulage) to Firestore.</p>
          </div>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to reset to the default demo data in Firestore? All custom entries will be replaced.')) {
                onResetSeedData();
              }
            }}
            className="h-10 px-4 bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            <RotateCcw size={15} />
            <span>Reset Demo Data</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#FFDAD6]/40 border border-[#FFDAD6]">
          <div>
            <h3 className="text-sm font-bold text-[#BA1A1A]">Clear All Site Transactions</h3>
            <p className="text-xs text-[#75777E]">Wipes all logs in Firestore to start clean for a brand new real estate project.</p>
          </div>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to wipe all transaction records in Firestore? This cannot be undone.')) {
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

      {/* Phase 13: Historical Audit Trail Card */}
      <div className="bg-white rounded-2xl border border-[#E8EDFF] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E8EDFF]">
          <div>
            <h2 className="text-sm font-bold text-[#081B38] uppercase tracking-wider flex items-center gap-2">
              <Activity size={16} className="text-[#6B46C1]" />
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
                        <span>{evt.user || 'Engineer'}</span>
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
                    <td className="p-3 font-semibold text-[#081B38]">{evt.entity}</td>
                    <td className="p-3 text-[#44474D] max-w-md truncate">{evt.summary}</td>
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
