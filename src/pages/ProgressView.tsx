import React, { useState } from 'react';
import {
  CheckSquare,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { WorkProgressItem, WorkStatus } from '../types';
import { formatNaira } from '../utils/formatters';

interface ProgressViewProps {
  workProgress: WorkProgressItem[];
  onOpenWorkStreamModal: (initialData?: WorkProgressItem) => void;
  onUpdateWorkPercent: (id: string, newPercent: number) => void;
  onDeleteWorkStream: (id: string, name: string) => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  workProgress,
  onOpenWorkStreamModal,
  onUpdateWorkPercent,
  onDeleteWorkStream,
}) => {
  const [statusFilter, setStatusFilter] = useState<'All' | WorkStatus>('All');

  const filteredItems = workProgress.filter((item) => {
    if (statusFilter === 'All') return true;
    return item.status === statusFilter;
  });

  const totalBudget = workProgress.reduce((sum, item) => sum + item.expectedBudget, 0);
  const totalPaid = workProgress.reduce((sum, item) => sum + item.actualPaid, 0);
  const totalOutstanding = workProgress.reduce((sum, item) => sum + item.outstanding, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-[#E0E8FF] text-[#0F1E36] text-[11px] font-bold tracking-wider uppercase">
              Phase 3 Finishing
            </span>
            <span className="text-xs font-semibold text-[#75777E]">
              {workProgress.length} Active Streams
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#081B38] tracking-tight mt-1">
            Finishing Works Milestones
          </h1>
          <p className="text-xs text-[#75777E] mt-0.5">
            Snagging velocity, quality certification and completion tracking
          </p>
        </div>

        {/* Milestone Financial Summary & Add Button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-[#F1F3FF] px-4 py-2 rounded-xl border border-[#E0E8FF] flex items-center gap-4 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#75777E] block">
                Total Stream Budget
              </span>
              <span className="font-mono font-bold text-[#081B38]">
                {formatNaira(totalBudget)}
              </span>
            </div>
            <div className="border-l border-[#E0E8FF] pl-4">
              <span className="text-[10px] uppercase font-bold text-[#75777E] block">
                Outstanding
              </span>
              <span className="font-mono font-bold text-[#BA1A1A]">
                {formatNaira(totalOutstanding)}
              </span>
            </div>
          </div>

          <button
            onClick={() => onOpenWorkStreamModal()}
            className="h-11 px-4 bg-[#0F1E36] hover:bg-[#1A2B49] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span>+ Add Finishing Stream</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E8EDFF] pb-2 overflow-x-auto no-scrollbar">
        {(['All', 'In Progress', 'Completed', 'Not Started', 'On Hold'] as ('All' | WorkStatus)[]).map(
          (status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === status
                  ? 'bg-[#000412] text-white shadow-xs'
                  : 'text-[#44474D] hover:bg-[#E8EDFF] hover:text-[#081B38]'
              }`}
            >
              {status}{' '}
              {status === 'All'
                ? `(${workProgress.length})`
                : `(${workProgress.filter((w) => w.status === status).length})`}
            </button>
          )
        )}
      </div>

      {/* Work Stream Cards (Stitch Design Layout) */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-[#E8EDFF] space-y-3">
            <CheckSquare size={36} className="mx-auto text-[#75777E]" />
            <h3 className="font-bold text-[#081B38] text-base">No work streams found</h3>
            <p className="text-xs text-[#75777E] max-w-sm mx-auto">
              No streams match the selected status filter.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isComplete = item.completionPercent === 100;
            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs transition-all ${
                  isComplete ? 'border-[#DCFCE7]' : 'border-[#E8EDFF] hover:border-[#6B46C1]'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-[#E0E8FF] text-[#0F1E36] font-mono text-[10px] font-bold uppercase tracking-wider">
                        {item.category}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isComplete
                            ? 'bg-[#DCFCE7] text-[#15803D]'
                            : 'bg-[#F1F3FF] text-[#081B38]'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-[#081B38] leading-snug">{item.name}</h3>

                    {item.zone && (
                      <p className="text-xs text-[#6B46C1] font-semibold mt-0.5">{item.zone}</p>
                    )}

                    {item.snagNotes && (
                      <p className="text-xs text-[#75777E] mt-1 bg-[#F9F9FF] p-2 rounded-lg border border-[#E8EDFF]">
                        <span className="font-semibold text-[#081B38]">Snag notes:</span>{' '}
                        {item.snagNotes}
                      </p>
                    )}
                  </div>

                  {/* Financials pill */}
                  <div className="flex items-center gap-4 bg-[#F9F9FF] px-4 py-2.5 rounded-xl border border-[#E8EDFF] shrink-0 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-[#75777E] uppercase font-bold block">
                        Budget
                      </span>
                      <span className="font-bold text-[#081B38]">
                        {formatNaira(item.expectedBudget)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#75777E] uppercase font-bold block">
                        Disbursed
                      </span>
                      <span className="font-bold text-[#059669]">
                        {formatNaira(item.actualPaid)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#75777E] uppercase font-bold block">
                        Outstanding
                      </span>
                      <span
                        className={`font-bold ${
                          item.outstanding > 0 ? 'text-[#BA1A1A]' : 'text-[#059669]'
                        }`}
                      >
                        {formatNaira(item.outstanding)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stepper Progress Bar & Quick Percent Buttons (Stitch Pattern) */}
                <div className="mt-4 pt-4 border-t border-[#E8EDFF]">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-[#081B38]">Milestone Stepper:</span>
                    <span className="font-mono font-black text-sm text-[#081B38]">
                      {item.completionPercent}% Completed
                    </span>
                  </div>

                  {/* Stepper pills row */}
                  <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                    {[0, 25, 50, 75, 90, 100].map((pct) => {
                      const isSelected = item.completionPercent === pct;
                      const isPassed = item.completionPercent >= pct;
                      return (
                        <button
                          key={pct}
                          onClick={() => onUpdateWorkPercent(item.id, pct)}
                          className={`py-2 px-1 text-center rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#000412] text-white shadow-md ring-2 ring-[#000412]/30'
                              : isPassed
                              ? 'bg-[#E8EDFF] text-[#0F1E36] hover:bg-[#D7E2FF]'
                              : 'bg-[#F9F9FF] border border-[#E8EDFF] text-[#75777E] hover:bg-[#F1F3FF]'
                          }`}
                        >
                          {pct}%
                        </button>
                      );
                    })}
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <button
                      onClick={() => onUpdateWorkPercent(item.id, 100)}
                      className={`flex items-center gap-1 font-bold transition-colors cursor-pointer ${
                        isComplete ? 'text-[#059669]' : 'text-[#6B46C1] hover:underline'
                      }`}
                    >
                      <CheckCircle2 size={15} />
                      <span>{isComplete ? 'Milestone Certified & Signed Off' : 'Certify 100%'}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onOpenWorkStreamModal(item)}
                        className="p-1.5 rounded-lg text-[#75777E] hover:text-[#081B38] hover:bg-[#E8EDFF] cursor-pointer"
                        title="Edit Stream"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => onDeleteWorkStream(item.id, item.name)}
                        className="p-1.5 rounded-lg text-[#75777E] hover:text-[#BA1A1A] hover:bg-[#FFDAD6] cursor-pointer"
                        title="Delete Stream"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
