import React from 'react';
import {
  TrendingUp,
  Package,
  Users,
  Truck,
  Receipt,
  AlertTriangle,
  ArrowRight,
  Plus,
  Clock,
  Calendar,
  Layers,
  ChevronRight,
} from 'lucide-react';
import {
  ProjectSettings,
  PurchaseRecord,
  MaterialUsage,
  WorkProgressItem,
  Contractor,
  LabourPayment,
  BudgetCostItem,
} from '../types';
import { formatNaira, formatNairaCompact, formatDate, formatRelativeTime } from '../utils/formatters';

interface DashboardViewProps {
  project: ProjectSettings;
  metrics: {
    totalSpent: number;
    budgetCap: number;
    remainingBuffer: number;
    contingencyPercent: number;
    spentPercent: number;
    totalOutstanding: number;
    supplierOutstanding: number;
    contractorOutstanding: number;
    overallCompletionPercent: number;
    materialSpent: number;
    labourSpent: number;
    transportationSpent: number;
    otherSpent: number;
    stockInStoreValue: number;
    lowStockCount: number;
    budgetCategories: BudgetCostItem[];
  };
  purchases: PurchaseRecord[];
  usage: MaterialUsage[];
  workProgress: WorkProgressItem[];
  contractors: Contractor[];
  labourPayments: LabourPayment[];
  onNavigate: (tab: string) => void;
  onOpenPurchaseModal: () => void;
  onOpenUsageModal: () => void;
  onOpenPaymentModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  project,
  metrics,
  purchases,
  usage,
  workProgress,
  contractors,
  labourPayments,
  onNavigate,
  onOpenPurchaseModal,
  onOpenUsageModal,
  onOpenPaymentModal,
}) => {
  const activeStreams = workProgress.slice(0, 4);
  const recentPurchases = purchases.slice(0, 3);
  const recentPayments = labourPayments.slice(0, 3);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner: Project Title & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-[#E0E8FF] text-[#0F1E36] text-[11px] font-bold tracking-wider uppercase">
              {project?.code || '#LK2-884'}
            </span>
            <span className="text-xs font-semibold text-[#059669] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse"></span>
              Active Finishing Site
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#081B38] tracking-tight mt-1">
            {project?.name || 'Finishing Project'}
          </h1>
          <p className="text-xs text-[#75777E] flex items-center gap-2 mt-0.5">
            <span className="flex items-center gap-1">
              <Calendar size={13} /> Handover: {project?.handoverDate ? formatDate(project.handoverDate) : 'Pending'}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Users size={13} /> {project?.activeArtisans ?? 0} Artisans On-Site Today
            </span>
          </p>
        </div>

        {/* Action button cluster */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPurchaseModal}
            className="px-3.5 py-2.5 bg-[#0F1E36] hover:bg-[#1A2B49] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span>+ Purchase</span>
          </button>
          <button
            onClick={onOpenUsageModal}
            className="px-3.5 py-2.5 bg-[#6B46C1] hover:bg-[#553C9A] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span>+ Usage</span>
          </button>
          <button
            onClick={onOpenPaymentModal}
            className="px-3.5 py-2.5 bg-[#000412] hover:bg-[#0F1E36] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span>+ Disburse</span>
          </button>
        </div>
      </div>

      {/* Main KPI Row (Stitch Layout) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Spent */}
        <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#75777E] uppercase tracking-wider">
              Total Expenditure
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#E8EDFF] text-[#0F1E36] flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-mono text-2xl sm:text-3xl font-black text-[#081B38] tracking-tight">
              {formatNaira(metrics.totalSpent)}
            </div>
            <div className="flex items-center justify-between text-xs text-[#44474D] mt-2 pt-2 border-t border-[#F1F3FF]">
              <span>Cap: {formatNairaCompact(metrics.budgetCap)}</span>
              <span className="font-mono font-bold text-[#6B46C1]">
                {metrics.spentPercent}% committed
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Remaining Contingency Buffer */}
        <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#75777E] uppercase tracking-wider">
              Remaining Buffer
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#DCFCE7] text-[#15803D] flex items-center justify-center">
              <Layers size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-mono text-2xl sm:text-3xl font-black text-[#15803D] tracking-tight">
              {formatNaira(metrics.remainingBuffer)}
            </div>
            <div className="flex items-center justify-between text-xs text-[#44474D] mt-2 pt-2 border-t border-[#F1F3FF]">
              <span>Fiscal Health</span>
              <span className="font-mono font-bold text-[#15803D]">
                {metrics.contingencyPercent}% buffer
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Finishing Velocity & Master Schedule */}
        <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#75777E] uppercase tracking-wider">
              Finishing Schedule
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#E0E8FF] text-[#000412] flex items-center justify-center font-mono font-bold text-xs">
              {metrics.overallCompletionPercent}%
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl sm:text-3xl font-black text-[#081B38] tracking-tight">
                {metrics.overallCompletionPercent}%
              </span>
              <span className="text-xs text-[#75777E]">overall velocity</span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 bg-[#E8EDFF] rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-[#000412] rounded-full transition-all duration-500"
                style={{ width: `${metrics.overallCompletionPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Outstanding Liabilities */}
        <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#75777E] uppercase tracking-wider">
              Pending Payables
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#FFDAD6] text-[#BA1A1A] flex items-center justify-center">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-mono text-2xl sm:text-3xl font-black text-[#BA1A1A] tracking-tight">
              {formatNaira(metrics.totalOutstanding)}
            </div>
            <div className="flex items-center justify-between text-xs text-[#44474D] mt-2 pt-2 border-t border-[#F1F3FF]">
              <span>Suppliers: {formatNairaCompact(metrics.supplierOutstanding)}</span>
              <span>Labour: {formatNairaCompact(metrics.contractorOutstanding)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fiscal Ledger Category Breakdown (Stitch Design) */}
      <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#081B38]">Fiscal Ledger Distribution</h2>
            <p className="text-xs text-[#75777E]">Cost breakdown across primary site expenditure pillars</p>
          </div>
          <button
            onClick={() => onNavigate('budget')}
            className="text-xs font-bold text-[#6B46C1] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Budget Matrix</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Materials */}
          <div
            onClick={() => onNavigate('materials')}
            className="p-4 rounded-xl bg-[#F9F9FF] border border-[#E8EDFF] hover:border-[#6B46C1] transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#081B38] flex items-center gap-1.5">
                <Package size={15} className="text-[#0F1E36]" /> Materials
              </span>
              <span className="text-[11px] font-mono text-[#75777E]">
                {metrics.totalSpent > 0
                  ? `${Math.round((metrics.materialSpent / metrics.totalSpent) * 100)}%`
                  : '0%'}
              </span>
            </div>
            <div className="font-mono font-bold text-lg text-[#081B38]">
              {formatNaira(metrics.materialSpent)}
            </div>
            <div className="mt-2 text-[11px] text-[#75777E] flex items-center justify-between">
              <span>Vault Stock Value:</span>
              <span className="font-mono font-bold text-[#0F1E36]">
                {formatNaira(metrics.stockInStoreValue)}
              </span>
            </div>
          </div>

          {/* Labour */}
          <div
            onClick={() => onNavigate('labour')}
            className="p-4 rounded-xl bg-[#F9F9FF] border border-[#E8EDFF] hover:border-[#6B46C1] transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#081B38] flex items-center gap-1.5">
                <Users size={15} className="text-[#6B46C1]" /> Labour Disbursements
              </span>
              <span className="text-[11px] font-mono text-[#75777E]">
                {metrics.totalSpent > 0
                  ? `${Math.round((metrics.labourSpent / metrics.totalSpent) * 100)}%`
                  : '0%'}
              </span>
            </div>
            <div className="font-mono font-bold text-lg text-[#081B38]">
              {formatNaira(metrics.labourSpent)}
            </div>
            <div className="mt-2 text-[11px] text-[#75777E] flex items-center justify-between">
              <span>Active Trades:</span>
              <span className="font-bold text-[#081B38]">{contractors.length} Subcontractors</span>
            </div>
          </div>

          {/* Transportation */}
          <div
            onClick={() => onNavigate('transport')}
            className="p-4 rounded-xl bg-[#F9F9FF] border border-[#E8EDFF] hover:border-[#6B46C1] transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#081B38] flex items-center gap-1.5">
                <Truck size={15} className="text-[#F59E0B]" /> Haulage & Tippers
              </span>
              <span className="text-[11px] font-mono text-[#75777E]">
                {metrics.totalSpent > 0
                  ? `${Math.round((metrics.transportationSpent / metrics.totalSpent) * 100)}%`
                  : '0%'}
              </span>
            </div>
            <div className="font-mono font-bold text-lg text-[#081B38]">
              {formatNaira(metrics.transportationSpent)}
            </div>
            <div className="mt-2 text-[11px] text-[#75777E]">
              Site deliveries & bulk logistics
            </div>
          </div>

          {/* Other Expenses */}
          <div
            onClick={() => onNavigate('expenses')}
            className="p-4 rounded-xl bg-[#F9F9FF] border border-[#E8EDFF] hover:border-[#6B46C1] transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#081B38] flex items-center gap-1.5">
                <Receipt size={15} className="text-[#BA1A1A]" /> Site Utilities & Sundry
              </span>
              <span className="text-[11px] font-mono text-[#75777E]">
                {metrics.totalSpent > 0
                  ? `${Math.round((metrics.otherSpent / metrics.totalSpent) * 100)}%`
                  : '0%'}
              </span>
            </div>
            <div className="font-mono font-bold text-lg text-[#081B38]">
              {formatNaira(metrics.otherSpent)}
            </div>
            <div className="mt-2 text-[11px] text-[#75777E]">
              Generator diesel, security, tools
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Grid: Finishing Stream Velocity + Recent Disbursements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Finishing Milestone Velocity */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#081B38]">Finishing Stream Velocity</h2>
              <p className="text-xs text-[#75777E]">Active finishing trades and completion milestones</p>
            </div>
            <button
              onClick={() => onNavigate('progress')}
              className="text-xs font-bold text-[#6B46C1] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All ({workProgress.length})</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="space-y-3">
            {activeStreams.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#75777E]">
                No finishing streams registered yet.
              </div>
            ) : (
              activeStreams.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-[#E8EDFF] bg-[#F9F9FF] hover:bg-white transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#081B38]">{item.name}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.completionPercent === 100
                              ? 'bg-[#DCFCE7] text-[#15803D]'
                              : 'bg-[#E0E8FF] text-[#0F1E36]'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#75777E] mt-0.5">{item.zone || item.category}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-base text-[#081B38]">
                        {item.completionPercent}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-[#E8EDFF] rounded-full mt-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.completionPercent === 100 ? 'bg-[#059669]' : 'bg-[#6B46C1]'
                      }`}
                      style={{ width: `${item.completionPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#75777E] mt-2">
                    <span>Budget: {formatNaira(item.expectedBudget)}</span>
                    <span>Paid: {formatNaira(item.actualPaid)}</span>
                    <span className="font-mono font-bold text-[#BA1A1A]">
                      Bal: {formatNaira(item.outstanding)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Activity & Recent Disbursements */}
        <div className="lg:col-span-5 space-y-4">
          {/* Recent Labour Disbursements */}
          <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#081B38]">Recent Artisan Payouts</h3>
                <p className="text-xs text-[#75777E]">Milestone tranches released</p>
              </div>
              <button
                onClick={() => onNavigate('labour')}
                className="text-xs font-bold text-[#6B46C1] hover:underline"
              >
                Ledger
              </button>
            </div>

            <div className="space-y-2.5">
              {recentPayments.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-xl bg-[#F9F9FF] border border-[#E8EDFF] flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs font-bold text-[#081B38] truncate">{p.contractorName}</div>
                    <div className="text-[11px] text-[#75777E] truncate">{p.milestoneTitle}</div>
                    <div className="text-[10px] text-[#75777E] font-mono mt-0.5">
                      {formatDate(p.paymentDate)} • {p.paymentMethod}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-xs text-[#059669]">
                      {formatNaira(p.amount)}
                    </div>
                    <span className="text-[10px] text-[#75777E]">Released</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Material Purchases */}
          <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#081B38]">Recent Material Inflow</h3>
                <p className="text-xs text-[#75777E]">Consignments received at site</p>
              </div>
              <button
                onClick={() => onNavigate('materials')}
                className="text-xs font-bold text-[#6B46C1] hover:underline"
              >
                Vault
              </button>
            </div>

            <div className="space-y-2.5">
              {recentPurchases.map((pur) => (
                <div
                  key={pur.id}
                  className="p-3 rounded-xl bg-[#F9F9FF] border border-[#E8EDFF] flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs font-bold text-[#081B38] truncate">{pur.materialName}</div>
                    <div className="text-[11px] text-[#75777E]">
                      {pur.quantity} {pur.unit} • {pur.supplier}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-xs text-[#081B38]">
                      {formatNaira(pur.acquisitionCost)}
                    </div>
                    {pur.supplierBalance > 0 ? (
                      <span className="text-[10px] font-mono text-[#BA1A1A] block">
                        Bal: {formatNaira(pur.supplierBalance)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#059669] block">Fully Paid</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
