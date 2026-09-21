import React, { useState } from 'react';
import { X, Package, Save } from 'lucide-react';
import { Material, MaterialCategory } from '../../types';

interface MaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Material, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>;
}

const CATEGORIES: MaterialCategory[] = [
  'Tiles', 'POP', 'Cement', 'Sand', 'Plumbing', 'Electrical', 'Paint',
  'Aluminium', 'Carpentry', 'Doors', 'Windows', 'Masonry', 'Other',
];

export const MaterialModal: React.FC<MaterialModalProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MaterialCategory>('Tiles');
  const [unit, setUnit] = useState('boxes');
  const [lowStockThreshold, setLowStockThreshold] = useState('0');
  const [supplier, setSupplier] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetAndClose = () => {
    if (saving) return;
    setName('');
    setCategory('Tiles');
    setUnit('boxes');
    setLowStockThreshold('0');
    setSupplier('');
    setLotNumber('');
    setNotes('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedUnit = unit.trim();
    const trimmedSupplier = supplier.trim();
    const threshold = Number(lowStockThreshold);

    if (!trimmedName || !trimmedUnit || !trimmedSupplier) {
      setError('Material name, unit of measure, and supplier/merchant are required.');
      return;
    }
    if (!Number.isFinite(threshold) || threshold < 0) {
      setError('Low-stock threshold must be zero or a positive number.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: trimmedName,
        category,
        unit: trimmedUnit,
        supplier: trimmedSupplier,
        ...(lotNumber.trim() ? { lotNumber: lotNumber.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lowStockThreshold: threshold,
        totalPurchased: 0,
        totalUsed: 0,
        remaining: 0,
        avgUnitPriceKobo: 0,
        totalCostKobo: 0,
        unitPriceKobo: 0,
        avgUnitPrice: 0,
        totalCost: 0,
      });
      resetAndClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to register material.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-[#000412]/45 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-[#E8EDFF] shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E8EDFF] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F1F3FF] text-[#081B38] flex items-center justify-center">
              <Package size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#081B38]">Register Material</h2>
              <p className="text-[10px] text-[#75777E]">Create a catalogue item before recording its purchase.</p>
            </div>
          </div>
          <button type="button" onClick={resetAndClose} className="p-2 rounded-lg hover:bg-[#F1F3FF] text-[#75777E] cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="px-3 py-2.5 rounded-xl bg-[#FFE4E1] border border-[#FFB4AB] text-[#BA1A1A] text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-[#44474D] mb-1.5">Material name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Test Floor Tiles" autoFocus className="w-full h-10 px-3 text-xs bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[#44474D] mb-1.5">Category *</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as MaterialCategory)} className="w-full h-10 px-3 text-xs bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38]">
                {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[#44474D] mb-1.5">Unit of measure *</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="boxes, bags, litres..." className="w-full h-10 px-3 text-xs bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[#44474D] mb-1.5">Low-stock / reorder level</label>
              <input type="number" min="0" step="0.01" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} placeholder="0 = no warning" className="w-full h-10 px-3 text-xs bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38]" />
              <p className="mt-1 text-[9px] text-[#75777E]">Warn when remaining stock reaches this level.</p>
            </div>
            <div className="flex items-end">
              <div className="w-full rounded-xl bg-[#F1F3FF] border border-[#E8EDFF] px-3 py-2.5 text-[10px] text-[#44474D]">
                Set this according to the site's expected consumption and replenishment cycle.
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-[#44474D] mb-1.5">Supplier / merchant *</label>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. CDK Porcelain Lagos" className="w-full h-10 px-3 text-xs bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38]" />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-[#44474D] mb-1.5">Lot / batch number</label>
            <input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} placeholder="Optional" className="w-full h-10 px-3 text-xs bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38]" />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-[#44474D] mb-1.5">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional site or catalogue notes" className="w-full px-3 py-2.5 text-xs bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38] resize-none" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={resetAndClose} disabled={saving} className="h-10 px-4 text-xs font-bold text-[#44474D] hover:bg-[#F1F3FF] rounded-xl cursor-pointer disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="h-10 px-4 bg-[#0F1E36] hover:bg-[#1A2B49] text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50">
              <Save size={15} />
              {saving ? 'Registering...' : 'Register Material'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
