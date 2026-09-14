import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Check,
  X,
  Layers,
} from 'lucide-react';
import { BudgetCostItem, ProjectSettings } from '../types';
import { formatNaira, formatNairaCompact } from '../utils/formatters';

interface BudgetViewProps {
  project: ProjectSettings;
  budgetCategories: BudgetCostItem[];
  totalSpent: number;
  budgetCap: number;
  remainingBuffer: number;
  contingencyPercent: number;
  totalOutstanding: number;
  onUpdateCategoryBudget: (categoryId: string, newBudget: number) => void;
  onUpdateBudgetCap: (newCap: number) => void;
}

const COLORS = ['#0F1E36', '#6B46C1', '#F59E0B', '#BA1A1A'];

export const BudgetView: React.FC<BudgetViewProps> = ({
  project,
  budgetCategories,
  totalSpent,
  budgetCap,
  remainingBuffer,
  contingencyPercent,
  totalOutstanding,
  onUpdateCategoryBudget,
  onUpdateBudgetCap,
}) => {
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number | ''>('');

  const [isEditingCap, setIsEditingCap] = useState(false);
  const [newCapValue, setNewCapValue] = useState<number | ''>(budgetCap);

  const startEditCategory = (cat: BudgetCostItem) => {
    setEditingCatId(cat.id);
    setEditAmount(cat.allocatedBudget);
  };

  const saveEditCategory = (catId: string) => {
    if (typeof editAmount === 'number' && editAmount > 0) {
      onUpdateCategoryBudget(catId, editAmount);
    }
    setEditingCatId(null);
  };

  const handleSaveCap = () => {
    if (typeof newCapValue === 'number' && newCapValue > 0) {
      onUpdateBudgetCap(newCapValue);
    }
    setIsEditingCap(false);
  };

  // Prepare chart data
  const pieData = budgetCategories.map((c) => ({
    name: c.category,
    value: c.actualSpent,
  }));

  const barData = budgetCategories.map((c) => ({
    category: c.category,
    Allocated: c.allocatedBudget,
    Actual: c.actualSpent,
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-[#E0E8FF] text-[#0F1E36] text-[11px] font-bold tracking-wider uppercase">
              Financial Control
            </span>
            <span className="text-xs font-semibold text-[#059669]">
              Live Variance & Contingency
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#081B38] tracking-tight mt-1">
            Budget Variance & Cost Analysis
          </h1>
          <p className="text-xs text-[#75777E] mt-0.5">
            Compare estimated bill of quantities against actual site disbursements
          </p>
        </div>

        {/* Budget Cap Pill */}
        <div className="flex items-center gap-3 bg-[#F1F3FF] px-4 py-2 rounded-xl border border-[#E0E8FF]">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#75777E] block">
              Approved Budget Ceiling
            </span>
            {isEditingCap ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <input
                  type="number"
                  value={newCapValue}
                  onChange={(e) => setNewCapValue(parseFloat(e.target.value) || '')}
                  className="w-32 h-8 px-2 text-xs font-mono font-bold bg-white border border-[#6B46C1] rounded-lg outline-none"
                />
                <button
                  onClick={handleSaveCap}
                  className="p-1.5 rounded-md bg-[#000412] text-white hover:bg-[#0F1E36] cursor-pointer"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => setIsEditingCap(false)}
                  className="p-1.5 rounded-md bg-[#E8EDFF] text-[#75777E] hover:text-[#081B38] cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-lg text-[#081B38]">
                  {formatNaira(budgetCap)}
                </span>
                <button
                  onClick={() => {
                    setNewCapValue(budgetCap);
                    setIsEditingCap(true);
                  }}
                  className="text-[#75777E] hover:text-[#6B46C1] p-1 cursor-pointer"
                  title="Edit Budget Ceiling"
                >
                  <Edit2 size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs">
          <span className="text-xs font-bold text-[#75777E] uppercase tracking-wider block">
            Total Actual Spent
          </span>
          <span className="font-mono text-2xl font-black text-[#081B38] mt-1 block">
            {formatNaira(totalSpent)}
          </span>
          <div className="mt-2 flex items-center justify-between text-xs text-[#75777E] pt-2 border-t border-[#F1F3FF]">
            <span>Ceiling:</span>
            <span className="font-mono font-bold text-[#6B46C1]">
              {Math.round((totalSpent / budgetCap) * 100)}% utilized
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs">
          <span className="text-xs font-bold text-[#75777E] uppercase tracking-wider block">
            Remaining Buffer
          </span>
          <span className="font-mono text-2xl font-black text-[#15803D] mt-1 block">
            {formatNaira(remainingBuffer)}
          </span>
          <div className="mt-2 flex items-center justify-between text-xs text-[#75777E] pt-2 border-t border-[#F1F3FF]">
            <span>Contingency:</span>
            <span className="font-mono font-bold text-[#15803D]">
              {contingencyPercent}% of Cap
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs">
          <span className="text-xs font-bold text-[#75777E] uppercase tracking-wider block">
            Committed Liabilities
          </span>
          <span className="font-mono text-2xl font-black text-[#BA1A1A] mt-1 block">
            {formatNaira(totalOutstanding)}
          </span>
          <div className="mt-2 flex items-center justify-between text-xs text-[#75777E] pt-2 border-t border-[#F1F3FF]">
            <span>Pending settlement:</span>
            <span className="text-xs font-bold text-[#BA1A1A]">Suppliers + Artisans</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs">
          <span className="text-xs font-bold text-[#75777E] uppercase tracking-wider block">
            Forecast at Handover
          </span>
          <span className="font-mono text-2xl font-black text-[#081B38] mt-1 block">
            {formatNaira(totalSpent + totalOutstanding)}
          </span>
          <div className="mt-2 flex items-center justify-between text-xs text-[#75777E] pt-2 border-t border-[#F1F3FF]">
            <span>Projected Margin:</span>
            <span className="font-mono font-bold text-[#059669]">
              +{formatNaira(budgetCap - (totalSpent + totalOutstanding))}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Row: Charts (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Expenditure Donut (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#081B38]">Cost Distribution Share</h3>
            <p className="text-xs text-[#75777E]">Percentage allocation across construction pillars</p>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => formatNaira(Number(value) || 0)}
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: '#E8EDFF',
                    fontFamily: 'JetBrains Mono',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#F1F3FF]">
            {budgetCategories.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="text-[#44474D] truncate">{c.category}:</span>
                <span className="font-mono font-bold text-[#081B38] ml-auto">
                  {formatNairaCompact(c.actualSpent)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Budget vs Actual Comparison (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#081B38]">Budget vs Actual by Pillar</h3>
            <p className="text-xs text-[#75777E]">Comparison of baseline estimates against disbursements</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#75777E' }} />
                <YAxis
                  tickFormatter={(val) => `₦${val / 1000000}M`}
                  tick={{ fontSize: 11, fill: '#75777E' }}
                />
                <Tooltip
                  formatter={(value: any) => formatNaira(Number(value) || 0)}
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: '#E8EDFF',
                    fontFamily: 'JetBrains Mono',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  iconType="circle"
                />
                <Bar dataKey="Allocated" fill="#E8EDFF" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Actual" fill="#000412" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-xs text-[#75777E] pt-2 border-t border-[#F1F3FF] flex items-center justify-between">
            <span>Allocated vs Actual Bar Comparison</span>
            <span className="text-[#059669] font-semibold">All categories currently within cap</span>
          </div>
        </div>
      </div>

      {/* Category Variance Matrix Table */}
      <div className="bg-white rounded-2xl border border-[#E8EDFF] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E8EDFF] flex items-center justify-between bg-[#F9F9FF]">
          <div>
            <h3 className="text-sm font-bold text-[#081B38]">Pillar Variance Matrix</h3>
            <p className="text-xs text-[#75777E]">Click the pencil icon to adjust pillar budget allocations</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E8EDFF] bg-[#F1F3FF] text-[#75777E] font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3.5">Expenditure Pillar</th>
                <th className="p-3.5">Allocated Budget</th>
                <th className="p-3.5">Actual Spent</th>
                <th className="p-3.5">Variance (Remaining)</th>
                <th className="p-3.5">Utilization %</th>
                <th className="p-3.5 text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EDFF]">
              {budgetCategories.map((cat) => {
                const percent =
                  cat.allocatedBudget > 0
                    ? Math.round((cat.actualSpent / cat.allocatedBudget) * 100)
                    : 0;
                const isOver = cat.variance < 0;
                const isEditing = editingCatId === cat.id;

                return (
                  <tr key={cat.id} className="hover:bg-[#F9F9FF] transition-colors">
                    <td className="p-3.5 font-bold text-[#081B38] text-sm">
                      {cat.category}
                    </td>

                    {/* Allocated */}
                    <td className="p-3.5 font-mono">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(parseFloat(e.target.value) || '')}
                            className="w-28 h-8 px-2 text-xs font-mono font-bold bg-white border border-[#6B46C1] rounded-lg outline-none"
                          />
                          <button
                            onClick={() => saveEditCategory(cat.id)}
                            className="p-1 rounded-md bg-[#000412] text-white hover:bg-[#0F1E36] cursor-pointer"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={() => setEditingCatId(null)}
                            className="p-1 rounded-md bg-[#E8EDFF] text-[#75777E] hover:text-[#081B38] cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="font-bold text-[#081B38]">
                          {formatNaira(cat.allocatedBudget)}
                        </span>
                      )}
                    </td>

                    {/* Actual */}
                    <td className="p-3.5 font-mono font-bold text-[#081B38]">
                      {formatNaira(cat.actualSpent)}
                    </td>

                    {/* Variance */}
                    <td className="p-3.5 font-mono font-bold">
                      <span className={isOver ? 'text-[#BA1A1A]' : 'text-[#059669]'}>
                        {isOver ? '-' : '+'}
                        {formatNaira(Math.abs(cat.variance))}
                      </span>
                    </td>

                    {/* Utilization progress */}
                    <td className="p-3.5">
                      <div className="w-32">
                        <div className="flex items-center justify-between text-[11px] font-mono text-[#75777E] mb-1">
                          <span>{percent}%</span>
                          {isOver && <span className="text-[#BA1A1A] font-bold">Overrun</span>}
                        </div>
                        <div className="w-full h-2 bg-[#E8EDFF] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              percent > 100
                                ? 'bg-[#BA1A1A]'
                                : percent > 85
                                ? 'bg-[#D97706]'
                                : 'bg-[#000412]'
                            }`}
                            style={{ width: `${Math.min(100, percent)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="p-3.5 text-right">
                      {!isEditing && (
                        <button
                          onClick={() => startEditCategory(cat)}
                          className="p-1.5 rounded-lg text-[#75777E] hover:text-[#081B38] hover:bg-[#E8EDFF] cursor-pointer"
                          title="Edit Allocation"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
