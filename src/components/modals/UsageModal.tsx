import React, { useState, useEffect } from 'react';
import { X, Check, AlertTriangle, AlertCircle, Package } from 'lucide-react';
import { Material, MaterialUsage } from '../../types';

interface UsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<MaterialUsage, 'id' | 'createdAt'> & { id?: string }) => void;
  materials: Material[];
  initialData?: MaterialUsage | null;
  defaultMaterialId?: string;
}

export const UsageModal: React.FC<UsageModalProps> = ({
  isOpen,
  onClose,
  onSave,
  materials,
  initialData,
  defaultMaterialId,
}) => {
  const [materialId, setMaterialId] = useState('');
  const [quantityUsed, setQuantityUsed] = useState<number | ''>('');
  const [workArea, setWorkArea] = useState('');
  const [subcontractor, setSubcontractor] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setMaterialId(initialData.materialId);
      setQuantityUsed(initialData.quantityUsed);
      setWorkArea(initialData.workArea);
      setSubcontractor(initialData.subcontractor || '');
      setDate(initialData.date || new Date().toISOString().split('T')[0]);
      setNotes(initialData.notes || '');
    } else {
      setMaterialId(defaultMaterialId || (materials.length > 0 ? materials[0].id : ''));
      setQuantityUsed('');
      setWorkArea('');
      setSubcontractor('');
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
    setError(null);
  }, [initialData, defaultMaterialId, materials, isOpen]);

  if (!isOpen) return null;

  const selectedMaterial = materials.find((m) => m.id === materialId);
  const effectiveAvailable =
    initialData && initialData.materialId === selectedMaterial?.id
      ? (selectedMaterial?.remaining || 0) + (initialData.quantityUsed || 0)
      : (selectedMaterial?.remaining || 0);
  const numQty = typeof quantityUsed === 'number' ? quantityUsed : 0;
  const isOverstock = numQty > effectiveAvailable;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) {
      setError('Please select a valid material from the vault.');
      return;
    }
    if (numQty <= 0) {
      setError('Quantity used must be greater than 0.');
      return;
    }
    if (isOverstock) {
      setError(
        `Requested quantity (${numQty} ${selectedMaterial.unit}) exceeds available stock (${effectiveAvailable} ${selectedMaterial.unit}). Negative inventory is forbidden.`
      );
      return;
    }
    if (!workArea.trim()) {
      setError('Please specify the destination work area or room.');
      return;
    }

    try {
      onSave({
        id: initialData?.id,
        materialId: selectedMaterial.id,
        materialName: selectedMaterial.name,
        quantityUsed: numQty,
        unit: selectedMaterial.unit,
        workArea: workArea.trim(),
        subcontractor: subcontractor.trim() || undefined,
        date: date || new Date().toISOString().split('T')[0],
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record usage');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1E36]/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E8EDFF] w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E8EDFF] flex items-center justify-between bg-[#F9F9FF]">
          <div>
            <h2 className="text-lg font-bold text-[#081B38]">
              {initialData ? 'Edit Stock Dispensation' : 'Record Material Usage'}
            </h2>
            <p className="text-xs text-[#75777E]">Custody transfer & site work area allocation</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#E8EDFF] flex items-center justify-center text-[#44474D] hover:text-[#081B38] cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-[#FFDAD6] text-[#93000A] text-xs rounded-xl flex items-center gap-2 border border-[#FFB4AB]">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Material Selection */}
          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
              Select Material from Site Vault *
            </label>
            <select
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              className="w-full h-11 px-3 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none font-semibold text-[#081B38]"
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.remaining} {m.unit} in stock
                </option>
              ))}
            </select>
          </div>

          {/* Stock Level Indicator Banner */}
          {selectedMaterial && (
            <div className="p-3 bg-[#F1F3FF] rounded-xl border border-[#E0E8FF] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-[#6B46C1]" />
                <span className="text-[#44474D]">Available on Site:</span>
              </div>
              <div className="font-mono font-bold text-[#081B38]">
                {selectedMaterial.remaining} {selectedMaterial.unit}
              </div>
            </div>
          )}

          {/* Quantity Used with live negative guard */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#081B38] uppercase tracking-wider">
                Quantity Dispatched / Used *
              </label>
              {selectedMaterial && (
                <span className="text-[11px] text-[#75777E]">Unit: {selectedMaterial.unit}</span>
              )}
            </div>
            <input
              type="number"
              min="0.01"
              step="any"
              required
              value={quantityUsed}
              onChange={(e) => setQuantityUsed(e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder="e.g. 15"
              className={`w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border rounded-xl outline-none text-[#081B38] ${
                isOverstock
                  ? 'border-[#BA1A1A] focus:ring-1 focus:ring-[#BA1A1A] bg-[#FFDAD6]/20'
                  : 'border-[#C5C6CE] focus:border-[#6B46C1]'
              }`}
            />
            {isOverstock && (
              <p className="mt-1 text-xs text-[#BA1A1A] flex items-center gap-1 font-medium">
                <AlertTriangle size={13} />
                Exceeds available inventory of {effectiveAvailable} {selectedMaterial?.unit}!
              </p>
            )}
          </div>

          {/* Room / Work Area */}
          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
              Work Area / Room Installed *
            </label>
            <input
              type="text"
              required
              value={workArea}
              onChange={(e) => setWorkArea(e.target.value)}
              placeholder="e.g. Penthouse Suite & Master Bath"
              className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
            />
          </div>

          {/* Subcontractor taking custody */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Artisan / Subcontractor
              </label>
              <input
                type="text"
                value={subcontractor}
                onChange={(e) => setSubcontractor(e.target.value)}
                placeholder="e.g. Master Tiler Emeka"
                className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Dispatch Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
              Installation / Snagging Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Tile spacers and corner cuts verified. Zero off-cut wastage."
              className="w-full p-3 text-xs bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
            />
          </div>
        </form>

        {/* Footer */}
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
            className="px-5 py-2.5 bg-[#6B46C1] hover:bg-[#553C9A] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Check size={16} />
            <span>{initialData ? 'Update Usage' : 'Record Dispensation'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
