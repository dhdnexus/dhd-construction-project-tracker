import React, { useState } from 'react';
import { X, Building, DollarSign, Calendar, MapPin, User, Check, Plus } from 'lucide-react';
import { ProjectSettings } from '../../types';
import { formatNaira, parseNairaInput } from '../../utils/formatters';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectSettings[];
  activeProjectId: string;
  onSwitchProject: (id: string) => Promise<void>;
  onCreateProject: (data: Partial<ProjectSettings>) => Promise<ProjectSettings>;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  onSwitchProject,
  onCreateProject,
}) => {
  const [mode, setMode] = useState<'switch' | 'create'>(projects.length === 0 ? 'create' : 'switch');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [budgetCap, setBudgetCap] = useState<number | string>('');
  const [projectManager, setProjectManager] = useState('');
  const [handoverDate, setHandoverDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a project name.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      await onCreateProject({
        name: name.trim(),
        code: code.trim() || `#PRJ-${Math.floor(100 + Math.random() * 900)}`,
        siteAddress: siteAddress.trim(),
        location: siteAddress.trim(),
        budgetCap: typeof budgetCap === 'number' ? budgetCap : parseNairaInput(budgetCap) || 0,
        projectManager: projectManager.trim(),
        handoverDate: handoverDate || '',
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create project.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitch = async (id: string) => {
    setLoading(true);
    try {
      await onSwitchProject(id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to switch project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081B38]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#E8EDFF] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#E8EDFF] flex items-center justify-between bg-[#F9F9FF]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#000412] text-white flex items-center justify-center">
              <Building size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#081B38]">Construction Projects</h3>
              <p className="text-xs text-[#75777E]">Switch active site or initialize a new project workspace</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-[#75777E] hover:text-[#081B38] hover:bg-[#E8EDFF] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="p-5 border-b border-[#E8EDFF] bg-white">
          <div className="grid grid-cols-2 p-1 bg-[#F1F3FF] rounded-xl border border-[#E8EDFF]">
            <button
              type="button"
              onClick={() => {
                setMode('switch');
                setError(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'switch' ? 'bg-white text-[#081B38] shadow-xs' : 'text-[#75777E] hover:text-[#081B38]'
              }`}
            >
              Active Projects ({projects.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('create');
                setError(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'create' ? 'bg-white text-[#081B38] shadow-xs' : 'text-[#75777E] hover:text-[#081B38]'
              }`}
            >
              <Plus size={14} />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="p-3 mb-4 rounded-xl bg-[#FFDAD6] text-[#BA1A1A] text-xs font-semibold border border-[#FF5449]/30">
              {error}
            </div>
          )}

          {mode === 'switch' ? (
            projects.length === 0 ? (
              <div className="text-center py-8 px-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[#F1F3FF] text-[#081B38] flex items-center justify-center">
                  <Building size={24} />
                </div>
                <h4 className="text-sm font-bold text-[#081B38] mb-1">No Projects Found</h4>
                <p className="text-xs text-[#75777E] mb-4">
                  Create your first construction project workspace to start tracking materials, labor, and expenses.
                </p>
                <button
                  type="button"
                  onClick={() => setMode('create')}
                  className="px-4 py-2 bg-[#081B38] text-white text-xs font-bold rounded-xl hover:bg-[#000412] transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  <Plus size={14} />
                  <span>Create First Project</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((p) => {
                  const isActive = p.id === activeProjectId;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSwitch(p.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isActive
                          ? 'border-[#081B38] bg-[#F1F3FF]/60 shadow-xs'
                          : 'border-[#E8EDFF] hover:border-[#081B38]/40 hover:bg-[#F9F9FF]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-[#081B38]">{p.name}</span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white text-[#75777E] border border-[#E8EDFF]">
                            {p.code}
                          </span>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#75777E] mt-1 flex items-center gap-1">
                          <MapPin size={12} />
                          <span>{p.siteAddress || p.location || 'No location set'}</span>
                        </p>
                        <span className="text-[11px] font-mono text-[#081B38] mt-1 block">
                          Budget Cap: {formatNaira(p.budgetCap)}
                        </span>
                      </div>

                      {isActive && (
                        <div className="w-7 h-7 rounded-full bg-[#000412] text-white flex items-center justify-center shrink-0">
                          <Check size={15} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#44474D] mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Lekki Phase 2 Luxury Finishing"
                  className="w-full h-10 px-3 text-xs bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38] transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#44474D] mb-1">
                    Project Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. #LK2-884"
                    className="w-full h-10 px-3 text-xs font-mono bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#44474D] mb-1">
                    Budget Cap (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100000"
                    value={budgetCap}
                    onChange={(e) => setBudgetCap(e.target.value)}
                    placeholder="25,000,000"
                    className="w-full h-10 px-3 text-xs font-mono bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#44474D] mb-1">
                  Site Address / Location
                </label>
                <input
                  type="text"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  placeholder="e.g. Plot 14, Admiralty Way, Lekki, Lagos"
                  className="w-full h-10 px-3 text-xs bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38] transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#44474D] mb-1">
                    Project Manager
                  </label>
                  <input
                    type="text"
                    value={projectManager}
                    onChange={(e) => setProjectManager(e.target.value)}
                    placeholder="e.g. Engr. Babatunde"
                    className="w-full h-10 px-3 text-xs bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#44474D] mb-1">
                    Handover Target
                  </label>
                  <input
                    type="date"
                    value={handoverDate}
                    onChange={(e) => setHandoverDate(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38] transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#000412] hover:bg-[#0F1E36] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer mt-4"
              >
                <Plus size={16} />
                <span>{loading ? 'Creating Project...' : 'Create & Open Project'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
