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
} from 'lucide-react';
import { ProjectSettings } from '../types';
import { formatNaira } from '../utils/formatters';

interface SettingsViewProps {
  project: ProjectSettings;
  onUpdateProject: (updates: Partial<ProjectSettings>) => void;
  onResetSeedData: () => void;
  onClearAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  project,
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
    const backup: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('dhd_')) {
        backup[key] = JSON.parse(localStorage.getItem(key) || 'null');
      }
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
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
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        Object.entries(data).forEach(([k, v]) => {
          if (k.startsWith('dhd_')) {
            localStorage.setItem(k, JSON.stringify(v));
          }
        });
        window.location.reload();
      } catch (err) {
        alert('Failed to parse backup JSON file. Please check file format.');
      }
    };
    reader.readAsText(file);
  };

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

      {savedSuccess && (
        <div className="p-4 bg-[#DCFCE7] text-[#15803D] rounded-xl flex items-center gap-2 border border-[#BBF7D0] text-xs font-bold animate-in fade-in">
          <Check size={16} />
          <span>Project settings successfully updated and saved!</span>
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
            <p className="text-xs text-[#75777E]">Download an offline JSON snapshot of all purchases, payments, materials and logs.</p>
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
            <p className="text-xs text-[#75777E]">Upload previously saved JSON backup to replace existing local records.</p>
          </div>
          <label className="h-10 px-4 bg-white border border-[#C5C6CE] hover:bg-[#F1F3FF] text-[#081B38] text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer">
            <Upload size={15} />
            <span>Restore JSON File</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A]">
          <div>
            <h3 className="text-sm font-bold text-[#B45309]">Reset to Initial Demo Data</h3>
            <p className="text-xs text-[#92400E]">Restores the realistic sample finishing site data (tiles, screeding, POP, haulage).</p>
          </div>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to reset to the default demo data? All custom entries will be overwritten.')) {
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
            <p className="text-xs text-[#75777E]">Wipes all logs to start clean for a brand new real estate project.</p>
          </div>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to wipe all transaction records? This cannot be undone.')) {
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
    </div>
  );
};
