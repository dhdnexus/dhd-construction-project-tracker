import React, { useState, useEffect } from 'react';
import { X, Check, User, AlertCircle } from 'lucide-react';
import { Contractor } from '../../types';

interface ContractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Contractor, 'id' | 'totalPaid' | 'outstandingBalance' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  initialData?: Contractor | null;
}

export const ContractorModal: React.FC<ContractorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] = useState('');
  const [trade, setTrade] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [agreedAmount, setAgreedAmount] = useState<number | ''>('');
  const [isVerified, setIsVerified] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setTrade(initialData.trade);
      setWorkDescription(initialData.workDescription);
      setAgreedAmount(initialData.agreedAmount);
      setIsVerified(initialData.isVerified);
      setNotes(initialData.notes || '');
    } else {
      setName('');
      setTrade('Tiling');
      setWorkDescription('');
      setAgreedAmount('');
      setIsVerified(true);
      setNotes('');
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const numAgreed = typeof agreedAmount === 'number' ? agreedAmount : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide contractor or team name');
      return;
    }
    if (numAgreed <= 0) {
      setError('Agreed contract sum must be greater than 0');
      return;
    }

    try {
      onSave({
        id: initialData?.id,
        name: name.trim(),
        trade: trade.trim() || 'General Contractor',
        workDescription: workDescription.trim() || 'Finishing Works',
        agreedAmount: numAgreed,
        isVerified,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error saving contractor');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1E36]/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E8EDFF] w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-[#E8EDFF] flex items-center justify-between bg-[#F9F9FF]">
          <div>
            <h2 className="text-lg font-bold text-[#081B38]">
              {initialData ? 'Edit Subcontractor' : 'Onboard Subcontractor / Artisan'}
            </h2>
            <p className="text-xs text-[#75777E]">Agreed terms, trade credentials & multi-payment tracking</p>
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
              Contractor / Artisan Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Master Tiler Emeka & Team"
              className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Trade Specialty *
              </label>
              <input
                type="text"
                required
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                placeholder="e.g. Tiling, POP Plaster"
                className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Agreed Sum (₦) *
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={agreedAmount}
                onChange={(e) => setAgreedAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="1100000"
                className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
              Work Package Scope Description
            </label>
            <input
              type="text"
              value={workDescription}
              onChange={(e) => setWorkDescription(e.target.value)}
              placeholder="e.g. Main House & Balcony Tiling"
              className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isVerified"
              checked={isVerified}
              onChange={(e) => setIsVerified(e.target.checked)}
              className="w-4 h-4 rounded text-[#6B46C1] focus:ring-[#6B46C1]"
            />
            <label htmlFor="isVerified" className="text-xs font-semibold text-[#081B38]">
              Identity & Site Security Clearance Verified
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
              Notes & Contract Terms
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Milestone release: 40% mobilization, 35% mid-phase, 25% retention handover."
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
            <span>{initialData ? 'Update Terms' : 'Add Contractor'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
