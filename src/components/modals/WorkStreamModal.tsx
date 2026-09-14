import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { WorkProgressItem, WorkStatus } from '../../types';

interface WorkStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<WorkProgressItem, 'id' | 'outstanding' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  initialData?: WorkProgressItem | null;
}

const WORK_STATUSES: WorkStatus[] = ['Not Started', 'In Progress', 'Completed', 'On Hold'];

export const WorkStreamModal: React.FC<WorkStreamModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<WorkStatus>('In Progress');
  const [completionPercent, setCompletionPercent] = useState<number>(0);
  const [expectedBudget, setExpectedBudget] = useState<number | ''>('');
  const [actualPaid, setActualPaid] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [zone, setZone] = useState('');
  const [snagNotes, setSnagNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setCategory(initialData.category);
      setStatus(initialData.status);
      setCompletionPercent(initialData.completionPercent);
      setExpectedBudget(initialData.expectedBudget);
      setActualPaid(initialData.actualPaid);
      setStartDate(initialData.startDate || '');
      setTargetDate(initialData.targetDate || '');
      setZone(initialData.zone || '');
      setSnagNotes(initialData.snagNotes || '');
      setNotes(initialData.notes || '');
    } else {
      setName('');
      setCategory('Finishes');
      setStatus('In Progress');
      setCompletionPercent(10);
      setExpectedBudget('');
      setActualPaid('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setTargetDate('');
      setZone('');
      setSnagNotes('');
      setNotes('');
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const numExpected = typeof expectedBudget === 'number' ? expectedBudget : 0;
  const numActual = typeof actualPaid === 'number' ? actualPaid : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a work stream title');
      return;
    }

    try {
      onSave({
        id: initialData?.id,
        name: name.trim(),
        category: category.trim() || 'General Finishing',
        status,
        completionPercent,
        expectedBudget: numExpected,
        actualPaid: numActual,
        startDate: startDate || new Date().toISOString().split('T')[0],
        targetDate: targetDate || '',
        zone: zone.trim() || undefined,
        snagNotes: snagNotes.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error saving work stream');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1E36]/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E8EDFF] w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-[#E8EDFF] flex items-center justify-between bg-[#F9F9FF]">
          <div>
            <h2 className="text-lg font-bold text-[#081B38]">
              {initialData ? 'Edit Finishing Stream' : 'Add Finishing Work Stream'}
            </h2>
            <p className="text-xs text-[#75777E]">Milestone tracking, budget & completion velocity</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#E8EDFF] flex items-center justify-center text-[#44474D] hover:text-[#081B38] cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-[#FFDAD6] text-[#93000A] text-xs rounded-xl flex items-center gap-2 border border-[#FFB4AB]">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
              Work Stream / Scope Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Master Suite POP & Cornices"
              className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Trade / Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Wet Areas & Living"
                className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Execution Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as WorkStatus)}
                className="w-full h-11 px-3 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none font-semibold text-[#081B38]"
              >
                {WORK_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stepper completion quick pills */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#081B38] uppercase tracking-wider">
                Completion Progress ({completionPercent}%)
              </label>
              <span className="text-[11px] font-mono font-bold text-[#6B46C1]">
                {completionPercent === 100 ? 'Certified Complete' : 'In Progress'}
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5 mb-2">
              {[0, 25, 50, 75, 90, 100].map((pct) => (
                <button
                  type="button"
                  key={pct}
                  onClick={() => setCompletionPercent(pct)}
                  className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    completionPercent === pct
                      ? 'bg-[#0F1E36] text-white shadow-xs'
                      : 'bg-[#F1F3FF] text-[#081B38] hover:bg-[#E0E8FF]'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={completionPercent}
              onChange={(e) => setCompletionPercent(parseInt(e.target.value))}
              className="w-full accent-[#6B46C1] cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Allocated Budget (₦)
              </label>
              <input
                type="number"
                min="0"
                value={expectedBudget}
                onChange={(e) => setExpectedBudget(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="1200000"
                className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Actual Paid to Date (₦)
              </label>
              <input
                type="number"
                min="0"
                value={actualPaid}
                onChange={(e) => setActualPaid(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="950000"
                className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
              Location / Zone
            </label>
            <input
              type="text"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              placeholder="Zone: Penthouse Suite & Living Hall"
              className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
              Snagging / Inspection Notes
            </label>
            <textarea
              rows={2}
              value={snagNotes}
              onChange={(e) => setSnagNotes(e.target.value)}
              placeholder="e.g. Master bedroom cornice adjustment pending final alignment check."
              className="w-full p-3 text-xs bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
            />
          </div>
        </form>

        <div className="p-4 border-t border-[#E8EDFF] bg-[#F9F9FF] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-[#44474D] hover:bg-[#E8EDFF] rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            type="button"
            className="px-5 py-2.5 bg-[#000412] hover:bg-[#0F1E36] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Check size={16} />
            <span>{initialData ? 'Save Stream Changes' : 'Create Stream'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
