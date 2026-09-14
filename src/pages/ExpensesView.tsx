import React, { useState } from 'react';
import {
  Receipt,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  DollarSign,
  Fuel,
  Wrench,
  Shield,
  Zap,
} from 'lucide-react';
import { OtherExpenseRecord, ExpenseCategory } from '../types';
import { formatNaira, formatDate } from '../utils/formatters';

interface ExpensesViewProps {
  expenses: OtherExpenseRecord[];
  onOpenExpenseModal: (initialData?: OtherExpenseRecord) => void;
  onDeleteExpense: (id: string, description: string) => void;
}

const CATEGORY_FILTERS: (ExpenseCategory | 'All')[] = [
  'All',
  'Fuel',
  'Tools',
  'Site logistics',
  'Repairs',
  'Security',
  'Utilities',
  'Miscellaneous',
];

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  onOpenExpenseModal,
  onDeleteExpense,
}) => {
  const [selectedCat, setSelectedCat] = useState<ExpenseCategory | 'All'>('All');

  const filteredExpenses = expenses.filter((e) => {
    if (selectedCat === 'All') return true;
    return e.category === selectedCat;
  });

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Group by category
  const categoryTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-[#E0E8FF] text-[#0F1E36] text-[11px] font-bold tracking-wider uppercase">
              Sundry Operations
            </span>
            <span className="text-xs font-semibold text-[#75777E]">
              {expenses.length} Expense Records
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#081B38] tracking-tight mt-1">
            Site Utilities & Other Expenses
          </h1>
          <p className="text-xs text-[#75777E] mt-0.5">
            Generator diesel, plant hire, emergency site repairs and security allowances
          </p>
        </div>

        <button
          onClick={() => onOpenExpenseModal()}
          className="h-11 px-4 bg-[#0F1E36] hover:bg-[#1A2B49] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <Plus size={16} />
          <span>+ Record Expense</span>
        </button>
      </div>

      {/* KPI & Category Breakdown Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#E8EDFF] shadow-xs">
          <span className="text-[11px] font-bold text-[#75777E] uppercase tracking-wider block">
            Total Sundry Expenses
          </span>
          <span className="font-mono text-xl sm:text-2xl font-black text-[#081B38] mt-1 block">
            {formatNaira(totalExpense)}
          </span>
          <span className="text-xs text-[#75777E] mt-1 block">Operational burn rate</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E8EDFF] shadow-xs">
          <span className="text-[11px] font-bold text-[#75777E] uppercase tracking-wider block">
            Generator Diesel & Fuel
          </span>
          <span className="font-mono text-xl sm:text-2xl font-black text-[#6B46C1] mt-1 block">
            {formatNaira(categoryTotals['Fuel'] || 0)}
          </span>
          <span className="text-xs text-[#75777E] mt-1 block">Power generation for cutting/tools</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E8EDFF] shadow-xs">
          <span className="text-[11px] font-bold text-[#75777E] uppercase tracking-wider block">
            Tool Hire & Equipment
          </span>
          <span className="font-mono text-xl sm:text-2xl font-black text-[#059669] mt-1 block">
            {formatNaira(categoryTotals['Tools'] || 0)}
          </span>
          <span className="text-xs text-[#75777E] mt-1 block">Scaffolding, vibrators & drills</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E8EDFF] shadow-xs">
          <span className="text-[11px] font-bold text-[#75777E] uppercase tracking-wider block">
            Site Security & Guards
          </span>
          <span className="font-mono text-xl sm:text-2xl font-black text-[#D97706] mt-1 block">
            {formatNaira(categoryTotals['Security'] || 0)}
          </span>
          <span className="text-xs text-[#75777E] mt-1 block">Night watch & material guard</span>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {CATEGORY_FILTERS.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCat(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              selectedCat === cat
                ? 'bg-[#000412] text-white shadow-xs'
                : 'bg-white border border-[#E8EDFF] text-[#44474D] hover:bg-[#F1F3FF]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-[#E8EDFF] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E8EDFF] flex items-center justify-between bg-[#F9F9FF]">
          <div>
            <h3 className="text-sm font-bold text-[#081B38]">Expenses Ledger</h3>
            <p className="text-xs text-[#75777E]">Disbursements, petty vouchers and approver trails</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E8EDFF] bg-[#F1F3FF] text-[#75777E] font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Description</th>
                <th className="p-3.5">Paid By / Voucher</th>
                <th className="p-3.5">Amount</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EDFF]">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#75777E]">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#F9F9FF] transition-colors">
                    <td className="p-3.5 font-mono text-[#75777E] whitespace-nowrap">
                      {formatDate(exp.date)}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-[#E0E8FF] text-[#0F1E36] font-mono text-[10px] font-bold">
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-3.5 font-medium text-[#081B38]">
                      <div>{exp.description}</div>
                      {exp.notes && (
                        <div className="text-[11px] text-[#75777E] mt-0.5">{exp.notes}</div>
                      )}
                    </td>
                    <td className="p-3.5">
                      <div className="text-[#081B38] font-medium">{exp.paidBy}</div>
                      {exp.receiptRef && (
                        <div className="text-[11px] text-[#75777E] font-mono">{exp.receiptRef}</div>
                      )}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-xs text-[#081B38]">
                      {formatNaira(exp.amount)}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onOpenExpenseModal(exp)}
                          className="p-1.5 rounded-lg text-[#75777E] hover:text-[#081B38] hover:bg-[#E8EDFF] cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => onDeleteExpense(exp.id, exp.description)}
                          className="p-1.5 rounded-lg text-[#75777E] hover:text-[#BA1A1A] hover:bg-[#FFDAD6] cursor-pointer"
                          title="Delete"
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
    </div>
  );
};
