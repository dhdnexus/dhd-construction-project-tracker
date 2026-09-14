import React, { useState, useEffect } from 'react';
import { X, Check, CreditCard, AlertCircle } from 'lucide-react';
import { Contractor, LabourPayment, PaymentMethod } from '../../types';
import { formatNaira } from '../../utils/formatters';

interface LabourPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<LabourPayment, 'id' | 'createdAt'> & { id?: string }) => void;
  contractors: Contractor[];
  initialData?: LabourPayment | null;
  defaultContractorId?: string;
}

export const LabourPaymentModal: React.FC<LabourPaymentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  contractors,
  initialData,
  defaultContractorId,
}) => {
  const [contractorId, setContractorId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Transfer');
  const [paymentDate, setPaymentDate] = useState('');
  const [receiptRef, setReceiptRef] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setContractorId(initialData.contractorId);
      setAmount(initialData.amount);
      setMilestoneTitle(initialData.milestoneTitle);
      setPaymentMethod(initialData.paymentMethod);
      setPaymentDate(initialData.paymentDate || new Date().toISOString().split('T')[0]);
      setReceiptRef(initialData.receiptRef || '');
      setNotes(initialData.notes || '');
    } else {
      setContractorId(defaultContractorId || (contractors.length > 0 ? contractors[0].id : ''));
      setAmount('');
      setMilestoneTitle('');
      setPaymentMethod('Transfer');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setReceiptRef('');
      setNotes('');
    }
    setError(null);
  }, [initialData, defaultContractorId, contractors, isOpen]);

  if (!isOpen) return null;

  const selectedContractor = contractors.find((c) => c.id === contractorId);
  const numAmount = typeof amount === 'number' ? amount : 0;
  const currentOutstanding = selectedContractor ? selectedContractor.outstandingBalance : 0;
  const remainingAfterPayment = Math.max(0, currentOutstanding - numAmount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractor) {
      setError('Please select a contractor');
      return;
    }
    if (numAmount <= 0) {
      setError('Payment amount must be greater than 0');
      return;
    }
    if (!milestoneTitle.trim()) {
      setError('Please specify the milestone or tranche reason');
      return;
    }

    try {
      onSave({
        id: initialData?.id,
        contractorId: selectedContractor.id,
        contractorName: selectedContractor.name,
        trade: selectedContractor.trade,
        amount: numAmount,
        milestoneTitle: milestoneTitle.trim(),
        paymentMethod,
        paymentDate: paymentDate || new Date().toISOString().split('T')[0],
        receiptRef: receiptRef.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error processing disbursement');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1E36]/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E8EDFF] w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E8EDFF] flex items-center justify-between bg-[#F9F9FF]">
          <div>
            <h2 className="text-lg font-bold text-[#081B38]">
              {initialData ? 'Edit Labour Payment' : 'Disburse Artisan Payment'}
            </h2>
            <p className="text-xs text-[#75777E]">Subcontractor contract tranche & milestone release</p>
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

          {/* Contractor selection */}
          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
              Select Subcontractor / Artisan *
            </label>
            <select
              value={contractorId}
              onChange={(e) => setContractorId(e.target.value)}
              className="w-full h-11 px-3 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none font-semibold text-[#081B38]"
            >
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.trade}) — Bal: {formatNaira(c.outstandingBalance)}
                </option>
              ))}
            </select>
          </div>

          {/* Contractor Financial Health Snapshot */}
          {selectedContractor && (
            <div className="p-3.5 bg-[#F1F3FF] rounded-xl border border-[#E0E8FF] space-y-2">
              <div className="flex items-center justify-between text-xs text-[#44474D]">
                <span>Agreed Contract Sum:</span>
                <span className="font-mono font-bold text-[#081B38]">
                  {formatNaira(selectedContractor.agreedAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#44474D]">
                <span>Total Paid to Date:</span>
                <span className="font-mono font-semibold text-[#059669]">
                  {formatNaira(selectedContractor.totalPaid)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#44474D] pt-1 border-t border-[#E0E8FF]">
                <span className="font-bold text-[#081B38]">Outstanding Liability:</span>
                <span className="font-mono font-bold text-[#BA1A1A]">
                  {formatNaira(selectedContractor.outstandingBalance)}
                </span>
              </div>
            </div>
          )}

          {/* Amount and Milestone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Disbursement Amount (₦) *
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="150000"
                className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full h-11 px-3 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none font-semibold text-[#081B38]"
              >
                <option value="Transfer">Bank Transfer</option>
                <option value="Cash">Site Cash Petty</option>
                <option value="Cheque">Bank Cheque</option>
              </select>
            </div>
          </div>

          {/* Milestone Description */}
          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
              Milestone / Tranche Description *
            </label>
            <input
              type="text"
              required
              value={milestoneTitle}
              onChange={(e) => setMilestoneTitle(e.target.value)}
              placeholder="e.g. 2nd Tranche - Living Area & Corridors Complete"
              className="w-full h-11 px-3.5 text-sm bg-[#F9F9FF] border border-[#C5C6CE] focus:border-[#6B46C1] focus:bg-white rounded-xl outline-none text-[#081B38]"
            />
          </div>

          {/* Date & Ref */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Disbursement Date
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
                Payment Ref / Receipt #
              </label>
              <input
                type="text"
                value={receiptRef}
                onChange={(e) => setReceiptRef(e.target.value)}
                placeholder="e.g. TX-9908"
                className="w-full h-11 px-3.5 text-sm font-mono bg-[#F9F9FF] border border-[#C5C6CE] rounded-xl outline-none text-[#081B38]"
              />
            </div>
          </div>

          {/* Live Post-Payment Preview */}
          <div className="p-3 bg-[#0F1E36] text-white rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-[#F59E0B]" />
              <span className="text-[#C5C6CE]">Balance After Release:</span>
            </div>
            <div className="font-mono font-bold text-[#F59E0B] text-sm">
              {formatNaira(remainingAfterPayment)}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#081B38] uppercase tracking-wider mb-1">
              Quality Sign-Off Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Snag inspection passed with site engineer. Verified work quality before wire transfer."
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
            className="px-5 py-2.5 bg-[#000412] hover:bg-[#0F1E36] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Check size={16} />
            <span>{initialData ? 'Update Payment' : 'Confirm Disbursement'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
