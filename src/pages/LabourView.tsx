import React, { useState } from 'react';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
} from 'lucide-react';
import { Contractor, LabourPayment } from '../types';
import { formatNaira, formatDate } from '../utils/formatters';

interface LabourViewProps {
  contractors: Contractor[];
  labourPayments: LabourPayment[];
  onOpenContractorModal: (initialData?: Contractor) => void;
  onOpenPaymentModal: (defaultContractorId?: string, initialData?: LabourPayment) => void;
  onDeleteContractor: (id: string, name: string) => void;
  onDeletePayment: (id: string, name: string) => void;
}

export const LabourView: React.FC<LabourViewProps> = ({
  contractors,
  labourPayments,
  onOpenContractorModal,
  onOpenPaymentModal,
  onDeleteContractor,
  onDeletePayment,
}) => {
  const [activeTab, setActiveTab] = useState<'contractors' | 'payments'>('contractors');
  const [expandedContractorId, setExpandedContractorId] = useState<string | null>(null);

  const totalAgreed = contractors.reduce((sum, c) => sum + c.agreedAmount, 0);
  const totalPaid = contractors.reduce((sum, c) => sum + c.totalPaid, 0);
  const totalOutstanding = contractors.reduce((sum, c) => sum + c.outstandingBalance, 0);
  const totalOverpaid = contractors.reduce((sum, c) => sum + (c.overpayment || 0), 0);

  const toggleExpand = (id: string) => {
    setExpandedContractorId(expandedContractorId === id ? null : id);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-[#E0E8FF] text-[#0F1E36] text-[11px] font-bold tracking-wider uppercase">
              Artisan Workforce
            </span>
            <span className="text-xs font-semibold text-[#75777E]">
              {contractors.length} Subcontractors Onboarded
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#081B38] tracking-tight mt-1">
            Subcontractor Ledger & Disbursements
          </h1>
          <p className="text-xs text-[#75777E] mt-0.5">
            Agreed contracts, milestone tranches and multi-payment reconciliation
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenContractorModal()}
            className="h-11 px-4 bg-[#0F1E36] hover:bg-[#1A2B49] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span>+ Add Contractor</span>
          </button>
          <button
            onClick={() => onOpenPaymentModal()}
            className="h-11 px-4 bg-[#6B46C1] hover:bg-[#553C9A] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <CreditCard size={16} />
            <span>Disburse Payment</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (Stitch Design) */}
      <div className={`grid grid-cols-1 ${totalOverpaid > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4`}>
        <div className="bg-white p-4 rounded-2xl border border-[#E8EDFF] shadow-xs">
          <span className="text-[11px] font-bold text-[#75777E] uppercase tracking-wider block">
            Agreed Contracts Sum
          </span>
          <span className="font-mono text-xl sm:text-2xl font-black text-[#081B38] mt-1 block">
            {formatNaira(totalAgreed)}
          </span>
          <span className="text-xs text-[#75777E] mt-1 block">
            Total contracted commitment
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E8EDFF] shadow-xs">
          <span className="text-[11px] font-bold text-[#75777E] uppercase tracking-wider block">
            Disbursed to Date
          </span>
          <span className="font-mono text-xl sm:text-2xl font-black text-[#059669] mt-1 block">
            {formatNaira(totalPaid)}
          </span>
          <span className="text-xs text-[#75777E] mt-1 block">
            {labourPayments.length} milestone tranches released
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E8EDFF] shadow-xs">
          <span className="text-[11px] font-bold text-[#75777E] uppercase tracking-wider block">
            Outstanding Liability
          </span>
          <span className="font-mono text-xl sm:text-2xl font-black text-[#BA1A1A] mt-1 block">
            {formatNaira(totalOutstanding)}
          </span>
          <span className="text-xs text-[#BA1A1A] font-semibold mt-1 block">
            Pending final milestone certification
          </span>
        </div>

        {totalOverpaid > 0 && (
          <div className="bg-white p-4 rounded-2xl border border-[#BBF7D0] shadow-xs bg-[#F0FDF4]">
            <span className="text-[11px] font-bold text-[#15803D] uppercase tracking-wider block">
              Recorded Overpayment
            </span>
            <span className="font-mono text-xl sm:text-2xl font-black text-[#15803D] mt-1 block">
              +{formatNaira(totalOverpaid)}
            </span>
            <span className="text-xs text-[#15803D] font-medium mt-1 block">
              Cumulative excess disbursements
            </span>
          </div>
        )}
      </div>

      {/* Sub-tabs: Contractor Cards vs All Disbursements History */}
      <div className="flex items-center gap-2 border-b border-[#E8EDFF] pb-2">
        <button
          onClick={() => setActiveTab('contractors')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'contractors'
              ? 'bg-[#000412] text-white shadow-xs'
              : 'text-[#44474D] hover:bg-[#E8EDFF] hover:text-[#081B38]'
          }`}
        >
          Subcontractors ({contractors.length})
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'payments'
              ? 'bg-[#000412] text-white shadow-xs'
              : 'text-[#44474D] hover:bg-[#E8EDFF] hover:text-[#081B38]'
          }`}
        >
          Disbursement Ledger ({labourPayments.length})
        </button>
      </div>

      {/* TAB 1: CONTRACTOR CARDS WITH MULTI-PAYMENT ACCORDION */}
      {activeTab === 'contractors' && (
        <div className="space-y-4">
          {contractors.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-[#E8EDFF] space-y-3">
              <Users size={36} className="mx-auto text-[#75777E]" />
              <h3 className="font-bold text-[#081B38] text-base">No contractors onboarded</h3>
              <p className="text-xs text-[#75777E] max-w-sm mx-auto">
                Add your lead tiler, plasterer, plumber or electrician to begin tracking contracts and payments.
              </p>
              <button
                onClick={() => onOpenContractorModal()}
                className="px-4 py-2 bg-[#0F1E36] text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                + Onboard Contractor
              </button>
            </div>
          ) : (
            contractors.map((contractor) => {
              const contractorPayments = labourPayments.filter(
                (p) => p.contractorId === contractor.id
              );
              const isExpanded = expandedContractorId === contractor.id;
              const isSettled = contractor.outstandingBalance === 0;

              return (
                <div
                  key={contractor.id}
                  className="bg-white rounded-2xl border border-[#E8EDFF] p-5 shadow-xs hover:border-[#6B46C1] transition-all"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Contractor Identity */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-2xl bg-[#000412] text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                        {contractor.avatar ? (
                          <img
                            src={contractor.avatar}
                            alt={contractor.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          contractor.name.substring(0, 2).toUpperCase()
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-[#081B38] truncate">
                            {contractor.name}
                          </h3>
                          {contractor.isVerified && (
                            <CheckCircle2 size={16} className="text-[#059669] shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-[#6B46C1] font-semibold">
                          Trade: {contractor.trade} • {contractor.workDescription}
                        </p>
                        {contractor.notes && (
                          <p className="text-xs text-[#75777E] mt-0.5">{contractor.notes}</p>
                        )}
                      </div>
                    </div>

                    {/* Financial Matrix for Contractor */}
                    <div className="flex items-center gap-3 sm:gap-6 bg-[#F9F9FF] p-3.5 rounded-xl border border-[#E8EDFF] shrink-0 font-mono text-xs">
                      <div>
                        <span className="text-[10px] text-[#75777E] uppercase font-bold block">
                          Agreed
                        </span>
                        <span className="font-bold text-[#081B38]">
                          {formatNaira(contractor.agreedAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#75777E] uppercase font-bold block">
                          Paid
                        </span>
                        <span className="font-bold text-[#059669]">
                          {formatNaira(contractor.totalPaid)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#75777E] uppercase font-bold block">
                          {(contractor.overpayment && contractor.overpayment > 0) ? 'Overpaid' : 'Balance'}
                        </span>
                        <span
                          className={`font-bold ${
                            (contractor.overpayment && contractor.overpayment > 0)
                              ? 'text-[#059669]'
                              : isSettled
                              ? 'text-[#059669]'
                              : 'text-[#BA1A1A]'
                          }`}
                        >
                          {(contractor.overpayment && contractor.overpayment > 0)
                            ? `+${formatNaira(contractor.overpayment)}`
                            : formatNaira(contractor.outstandingBalance)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onOpenPaymentModal(contractor.id)}
                        className="py-2 px-3 bg-[#6B46C1] hover:bg-[#553C9A] text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <CreditCard size={14} />
                        <span>Disburse</span>
                      </button>

                      <button
                        onClick={() => onOpenContractorModal(contractor)}
                        title="Edit Terms"
                        className="p-2 rounded-xl text-[#75777E] hover:text-[#081B38] hover:bg-[#E8EDFF] cursor-pointer"
                      >
                        <Edit2 size={16} />
                      </button>

                      <button
                        onClick={() => onDeleteContractor(contractor.id, contractor.name)}
                        title="Delete Contractor"
                        className="p-2 rounded-xl text-[#75777E] hover:text-[#BA1A1A] hover:bg-[#FFDAD6] cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>

                      <button
                        onClick={() => toggleExpand(contractor.id)}
                        title="Toggle Payments"
                        className="p-2 rounded-xl text-[#75777E] hover:bg-[#F1F3FF] cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Payment History Accordion */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-[#E8EDFF] bg-[#F9F9FF] p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-[#081B38]">
                        <span>Payment Tranches Released ({contractorPayments.length})</span>
                        <button
                          onClick={() => onOpenPaymentModal(contractor.id)}
                          className="text-[#6B46C1] hover:underline"
                        >
                          + Record Another Payment
                        </button>
                      </div>

                      {contractorPayments.length === 0 ? (
                        <p className="text-xs text-[#75777E] italic">
                          No payments disbursed to this contractor yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {contractorPayments.map((pay) => (
                            <div
                              key={pay.id}
                              className="bg-white p-3 rounded-lg border border-[#E8EDFF] flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-[#081B38] block">
                                  {pay.milestoneTitle}
                                </span>
                                <span className="text-[11px] text-[#75777E] font-mono">
                                  {formatDate(pay.paymentDate)} • {pay.paymentMethod}{' '}
                                  {pay.receiptRef && `• ${pay.receiptRef}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-[#059669]">
                                  {formatNaira(pay.amount)}
                                </span>
                                <button
                                  onClick={() => onDeletePayment(pay.id, pay.milestoneTitle)}
                                  className="text-[#75777E] hover:text-[#BA1A1A] p-1 cursor-pointer"
                                  title="Delete payment"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: ALL DISBURSEMENT LEDGER (Audit Table) */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-2xl border border-[#E8EDFF] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E8EDFF] flex items-center justify-between bg-[#F9F9FF]">
            <div>
              <h3 className="text-sm font-bold text-[#081B38]">Master Disbursement Ledger</h3>
              <p className="text-xs text-[#75777E]">Chronological audit of all artisan bank transfers and cash payouts</p>
            </div>
            <button
              onClick={() => onOpenPaymentModal()}
              className="h-9 px-3 bg-[#6B46C1] hover:bg-[#553C9A] text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Plus size={15} />
              <span>Disburse</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E8EDFF] bg-[#F1F3FF] text-[#75777E] font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Subcontractor & Trade</th>
                  <th className="p-3.5">Milestone / Scope</th>
                  <th className="p-3.5">Method & Ref</th>
                  <th className="p-3.5">Amount Disbursed</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EDFF]">
                {labourPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#75777E]">
                      No disbursements logged yet.
                    </td>
                  </tr>
                ) : (
                  labourPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-[#F9F9FF] transition-colors">
                      <td className="p-3.5 font-mono text-[#75777E] whitespace-nowrap">
                        {formatDate(p.paymentDate)}
                      </td>
                      <td className="p-3.5 font-semibold text-[#081B38]">
                        <div>{p.contractorName}</div>
                        <div className="text-[11px] text-[#6B46C1]">{p.trade}</div>
                      </td>
                      <td className="p-3.5 text-[#081B38]">{p.milestoneTitle}</td>
                      <td className="p-3.5 font-mono text-[11px] text-[#75777E]">
                        <div>{p.paymentMethod}</div>
                        <div>{p.receiptRef || '—'}</div>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-xs text-[#059669]">
                        {formatNaira(p.amount)}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onOpenPaymentModal(p.contractorId, p)}
                            className="p-1.5 rounded-lg text-[#75777E] hover:text-[#081B38] hover:bg-[#E8EDFF] cursor-pointer"
                            title="Edit Payment"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => onDeletePayment(p.id, p.milestoneTitle)}
                            className="p-1.5 rounded-lg text-[#75777E] hover:text-[#BA1A1A] hover:bg-[#FFDAD6] cursor-pointer"
                            title="Delete Payment"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
