import React, { useState, useEffect } from 'react';
import { X, Check, Truck, AlertCircle } from 'lucide-react';
import { TransportationRecord } from '../../types';

interface TransportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<TransportationRecord, 'id' | 'createdAt'> & { id?: string }) => void;
  initialData?: TransportationRecord | null;
}

export const TransportModal: React.FC<TransportModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [itemTransported, setItemTransported] = useState('');
  const [quantityDescription, setQuantityDescription] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('Site B, Lekki Phase 2');
  const [transporter, setTransporter] = useState('');
  const [cost, setCost] = useState<number | ''>('');
  const [date, setDate] = useState('');
  const [waybillRef, setWaybillRef] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setItemTransported(initialData.itemTransported);
      setQuantityDescription(initialData.quantityDescription);
      setFrom(initialData.from);
      setTo(initialData.to);
      setTransporter(initialData.transporter);
      setCost(initialData.cost);
      setDate(initialData.date || new Date().toISOString().split('T')[0]);
      setWaybillRef(initialData.waybillRef || '');
      setNotes(initialData.notes || '');
    } else {
      setItemTransported('');
      setQuantityDescription('');
      setFrom('');
      setTo('Site B, Lekki Phase 2');
      setTransporter('');
      setCost('');
      setDate(new Date().toISOString().split('T')[0]);
      setWaybillRef('');
      setNotes('');
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const numCost = typeof cost === 'number' ? cost : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTransported.trim()) {
      setError('Please specify the items hauled');
      return;
    }
    if (numCost <= 0) {
      setError('Haulage cost must be greater than 0');
      return;
    }

    try {
      onSave({
        id: initialData?.id,
        itemTransported: itemTransported.trim(),
        quantityDescription: quantityDescription.trim() || 'Single consignment',
        from: from.trim() || 'Material Depot',
        to: to.trim() || 'Site B, Lekki Phase 2',
        transporter: transporter.trim() || 'Independent Hauler',
        cost: numCost,
        date: date || new Date().toISOString().split('T')[0],
        waybillRef: waybillRef.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error saving haulage');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1E36]/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E8EDFF] w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-[#E8EDFF] flex items-center justify-between bg-[#F9F9FF]">
          <div>
            <h2 className="text-lg font-bold text-[#081B38]">
              {initialData ? 'Edit Haulage Record' : 'Log Transportation / Haulage'}
            </h2>
            <p className="text-xs text-[#75777E]">Tipper deliveries, logistics & site freight</p>
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
              Material / Item Transported *
            </label>
            <input
              type="text"
              required
              value={itemTransported}
              onChange={(e) => setItemTransported(e.target.value)}
              placeholder="e.g. 30 Tons Sharp Sand Tipper"
              className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Load / Quantity Description
              </label>
              <input
                type="text"
                value={quantityDescription}
                onChange={(e) => setQuantityDescription(e.target.value)}
                placeholder="e.g. 1 Tipper Load (30 tons)"
                className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Haulage Cost (₦) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={cost}
                onChange={(e) => setCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="45000"
                className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                From (Origin)
              </label>
              <input
                type="text"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="e.g. Epe Quarry Express"
                className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                To (Destination Site)
              </label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Site B, Lekki Phase 2"
                className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Transporter / Driver / Vehicle
              </label>
              <input
                type="text"
                value={transporter}
                onChange={(e) => setTransporter(e.target.value)}
                placeholder="e.g. Sunday Haulage (FKJ-420-XX)"
                className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Date Dispatched
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Waybill Ref #
              </label>
              <input
                type="text"
                value={waybillRef}
                onChange={(e) => setWaybillRef(e.target.value)}
                placeholder="e.g. TR-088"
                className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Offloaded safely without impediment"
                className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
              />
            </div>
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
            <span>{initialData ? 'Update Haulage' : 'Save Haulage Log'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
