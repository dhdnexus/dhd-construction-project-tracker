import React, { useState, useEffect } from 'react';
import { X, Calculator, Truck, FileText, Check, AlertCircle } from 'lucide-react';
import { PurchaseRecord, MaterialCategory } from '../../types';
import { calculatePurchaseTotals, formatNaira } from '../../utils/formatters';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<PurchaseRecord, 'id' | 'materialCost' | 'acquisitionCost' | 'supplierBalance' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  initialData?: PurchaseRecord | null;
  existingMaterials?: (string | { name: string; id?: string; category?: MaterialCategory; unit?: string })[];
}

const CATEGORIES: MaterialCategory[] = [
  'POP',
  'Tiles',
  'Paint',
  'Plumbing',
  'Electrical',
  'Sand',
  'Cement',
  'Aluminium',
  'Carpentry',
  'Doors',
  'Windows',
  'Masonry',
  'Other',
];

const COMMON_UNITS = ['boxes', 'bags', 'drums', 'lengths', 'tippers', 'pieces', 'rolls', 'cartons', 'tons'];

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  existingMaterials = [],
}) => {
  const [materialName, setMaterialName] = useState('');
  const [category, setCategory] = useState<MaterialCategory>('Tiles');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unit, setUnit] = useState('boxes');
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [haulageCost, setHaulageCost] = useState<number | ''>('');
  const [offloadingCost, setOffloadingCost] = useState<number | ''>('');
  const [otherCost, setOtherCost] = useState<number | ''>('');
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [supplier, setSupplier] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [waybillRef, setWaybillRef] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setMaterialName(initialData.materialName);
      setCategory(initialData.category);
      setQuantity(initialData.quantity);
      setUnit(initialData.unit);
      setUnitPrice(initialData.unitPrice);
      setHaulageCost(initialData.haulageCost || '');
      setOffloadingCost(initialData.offloadingCost || '');
      setOtherCost(initialData.otherCost || '');
      setAmountPaid(initialData.amountPaid || '');
      setSupplier(initialData.supplier || '');
      setPurchaseDate(initialData.purchaseDate || new Date().toISOString().split('T')[0]);
      setWaybillRef(initialData.waybillRef || '');
      setNotes(initialData.notes || '');
    } else {
      setMaterialName('');
      setCategory('Tiles');
      setQuantity('');
      setUnit('boxes');
      setUnitPrice('');
      setHaulageCost('');
      setOffloadingCost('');
      setOtherCost('');
      setAmountPaid('');
      setSupplier('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setWaybillRef('');
      setNotes('');
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const numQty = typeof quantity === 'number' ? quantity : 0;
  const numUnitPrice = typeof unitPrice === 'number' ? unitPrice : 0;
  const numHaulage = typeof haulageCost === 'number' ? haulageCost : 0;
  const numOffload = typeof offloadingCost === 'number' ? offloadingCost : 0;
  const numOther = typeof otherCost === 'number' ? otherCost : 0;
  const numPaid = typeof amountPaid === 'number' ? amountPaid : 0;

  const { materialCost, acquisitionCost, supplierBalance, supplierOverpayment } = calculatePurchaseTotals(
    numQty,
    numUnitPrice,
    numHaulage,
    numOffload,
    numOther,
    numPaid
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialName.trim()) {
      setError('Please specify the material name');
      return;
    }
    if (numQty <= 0) {
      setError('Quantity purchased must be greater than 0');
      return;
    }
    if (numUnitPrice <= 0) {
      setError('Unit price must be greater than 0');
      return;
    }

    try {
      onSave({
        id: initialData?.id,
        materialId: initialData?.materialId,
        materialName: materialName.trim(),
        category,
        quantity: numQty,
        unit,
        unitPrice: numUnitPrice,
        haulageCost: numHaulage,
        offloadingCost: numOffload,
        otherCost: numOther,
        amountPaid: numPaid,
        supplier: supplier.trim() || 'Direct Supplier',
        purchaseDate: purchaseDate || new Date().toISOString().split('T')[0],
        waybillRef: waybillRef.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error saving purchase');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1E36]/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E8EDFF] w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E8EDFF] flex items-center justify-between bg-[#F9F9FF]">
          <div>
            <h2 className="text-lg font-bold text-[#081B38]">
              {initialData ? 'Edit Material Purchase' : 'Record Material Purchase'}
            </h2>
            <p className="text-xs text-[#75777E]">Landed cost computation & supplier ledger</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#E8EDFF] flex items-center justify-center text-[#44474D] hover:text-[#081B38] cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-[#FFDAD6] text-[#93000A] text-xs rounded-xl flex items-center gap-2 border border-[#FFB4AB]">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Material Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Material Name *
              </label>
              <input
                type="text"
                list="material-suggestions"
                required
                value={materialName}
                onChange={(e) => setMaterialName(e.target.value)}
                placeholder="e.g. Spanish Glazed Tiles (60x60cm)"
                className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none font-medium text-[#081B38]"
              />
              <datalist id="material-suggestions">
                {existingMaterials.map((m, idx) => {
                  const val = typeof m === 'string' ? m : m.name;
                  return <option key={idx} value={val} />;
                })}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MaterialCategory)}
                className="w-full h-11 px-3 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none font-semibold text-[#081B38]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantity, Unit & Unit Price */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Quantity *
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="10"
                className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Unit of Measure
              </label>
              <input
                type="text"
                list="units-list"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="boxes, bags"
                className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
              />
              <datalist id="units-list">
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Unit Price (₦) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="15000"
                className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
              />
            </div>
          </div>

          {/* Landed Cost Breakdown inputs */}
          <div className="bg-[#F1F3FF] p-3.5 rounded-xl space-y-2.5 border border-[#E0E8FF]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F1E36] uppercase tracking-wider">
              <Truck size={15} />
              <span>Logistics & Landed Costs (₦)</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-[#44474D] mb-1">Haulage</label>
                <input
                  type="number"
                  min="0"
                  value={haulageCost}
                  onChange={(e) => setHaulageCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="20000"
                  className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-[#C5C6CE] rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#44474D] mb-1">Offloading</label>
                <input
                  type="number"
                  min="0"
                  value={offloadingCost}
                  onChange={(e) => setOffloadingCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="5000"
                  className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-[#C5C6CE] rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#44474D] mb-1">Other / Surcharge</label>
                <input
                  type="number"
                  min="0"
                  value={otherCost}
                  onChange={(e) => setOtherCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0"
                  className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-[#C5C6CE] rounded-lg outline-none"
                />
              </div>
            </div>
          </div>

          {/* Amount Paid vs Outstanding */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Amount Paid Upfront (₦)
              </label>
              <input
                type="number"
                min="0"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="100000"
                className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Supplier / Merchant
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g. CDK Porcelain Lagos"
                className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
              />
            </div>
          </div>

          {/* Date & Waybill */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Waybill / Invoice Ref #
              </label>
              <input
                type="text"
                value={waybillRef}
                onChange={(e) => setWaybillRef(e.target.value)}
                placeholder="e.g. WAY-8812"
                className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
              Inspection / Site Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Offloaded on wooden pallets in ground floor staging room. Inspected zero fractures."
              className="w-full p-3 text-xs bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
            />
          </div>

          {/* Live Calculated Financial Summary (Matches Section 30 Test!) */}
          <div className="p-4 bg-[#0F1E36] text-white rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-[#C5C6CE] pb-1 border-b border-white/10">
              <span className="flex items-center gap-1 font-semibold">
                <Calculator size={14} className="text-[#F59E0B]" />
                Landed Cost Computation
              </span>
              <span className="font-mono text-[11px] text-[#F59E0B]">Live Math Engine</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
              <div>
                <span className="text-[#818CF8] text-[10px] uppercase font-bold block">Material Cost</span>
                <span className="font-mono font-bold text-white text-sm">{formatNaira(materialCost)}</span>
              </div>
              <div>
                <span className="text-[#818CF8] text-[10px] uppercase font-bold block">Acquisition Cost</span>
                <span className="font-mono font-bold text-[#F59E0B] text-sm">{formatNaira(acquisitionCost)}</span>
              </div>
              <div>
                <span className="text-[#818CF8] text-[10px] uppercase font-bold block">Supplier Balance</span>
                <span className={`font-mono font-bold text-sm ${supplierBalance > 0 ? 'text-[#FF897D]' : 'text-[#34D399]'}`}>
                  {formatNaira(supplierBalance)}
                </span>
              </div>
              {supplierOverpayment > 0 && (
                <div>
                  <span className="text-[#34D399] text-[10px] uppercase font-bold block">Overpayment</span>
                  <span className="font-mono font-bold text-[#34D399] text-sm">
                    +{formatNaira(supplierOverpayment)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer actions */}
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
            <span>{initialData ? 'Save Changes' : 'Record Purchase'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
