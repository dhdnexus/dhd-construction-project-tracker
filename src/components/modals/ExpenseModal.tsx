import React, { useState, useEffect } from 'react';
import { X, Check, Receipt, AlertCircle } from 'lucide-react';
import { OtherExpenseRecord, ExpenseCategory } from '../../types';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<OtherExpenseRecord, 'id' | 'createdAt'> & { id?: string }) => void;
  initialData?: OtherExpenseRecord | null;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Fuel',
  'Tools',
  'Site logistics',
  'Repairs',
  'Security',
  'Utilities',
  'Miscellaneous',
  'Other',
];

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [category, setCategory] = useState<ExpenseCategory>('Fuel');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState('');
  const [paidBy, setPaidBy] = useState('Site Manager');
  const [receiptRef, setReceiptRef] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setCategory(initialData.category);
      setDescription(initialData.description);
      setAmount(initialData.amount);
      setDate(initialData.date || new Date().toISOString().split('T')[0]);
      setPaidBy(initialData.paidBy || 'Site Manager');
      setReceiptRef(initialData.receiptRef || '');
      setNotes(initialData.notes || '');
    } else {
      setCategory('Fuel');
      setDescription('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setPaidBy('Site Manager');
      setReceiptRef('');
      setNotes('');
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const numAmount = typeof amount === 'number' ? amount : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide an expense description');
      return;
    }
    if (numAmount <= 0) {
      setError('Expense amount must be greater than 0');
      return;
    }

    try {
      onSave({
        id: initialData?.id,
        category,
        description: description.trim(),
        amount: numAmount,
        date: date || new Date().toISOString().split('T')[0],
        paidBy: paidBy.trim() || 'Site Petty Cash',
        receiptRef: receiptRef.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error saving expense');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1E36]/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E8EDFF] w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-[#E8EDFF] flex items-center justify-between bg-[#F9F9FF]">
          <div>
            <h2 className="text-lg font-bold text-[#081B38]">
              {initialData ? 'Edit Expense Record' : 'Record Other Expense'}
            </h2>
            <p className="text-xs text-[#75777E]">Site generator fuel, tool hire, security & utilities</p>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Expense Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full h-11 px-3 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none font-semibold text-[#081B38]"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Amount (₦) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="45000"
                className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
              Description *
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Diesel for 30kVA Site Generator (Floor cutting power)"
              className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Paid By / Approver
              </label>
              <input
                type="text"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                placeholder="Site Manager"
                className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Expense Date
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
                Receipt / Voucher Ref
              </label>
              <input
                type="text"
                value={receiptRef}
                onChange={(e) => setReceiptRef(e.target.value)}
                placeholder="e.g. PETTY-092"
                className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Site Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Emergency replacement approved"
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
            <span>{initialData ? 'Update Expense' : 'Record Expense'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
