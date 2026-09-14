import React from 'react';
import {
  LayoutDashboard,
  Package,
  CheckSquare,
  Users,
  Truck,
  Receipt,
  PieChart,
  FileText,
  Settings,
  Plus,
} from 'lucide-react';
import { ProjectSettings } from '../../types';
import { formatNairaCompact } from '../../utils/formatters';

interface SidebarProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  project: ProjectSettings;
  materialsCount: number;
  lowStockCount: number;
  activeStreamsCount: number;
  totalSpent: number;
  onOpenPurchaseModal: () => void;
  onOpenUsageModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onNavigate,
  project,
  materialsCount,
  lowStockCount,
  activeStreamsCount,
  totalSpent,
  onOpenPurchaseModal,
  onOpenUsageModal,
}) => {
  const navGroups = [
    {
      title: 'CORE TRACKING',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        {
          id: 'materials',
          label: 'Materials & Vault',
          icon: Package,
          badge: lowStockCount > 0 ? `${lowStockCount} low` : `${materialsCount}`,
          badgeColor: lowStockCount > 0 ? 'bg-[#FFFBEB] text-[#D97706]' : 'bg-[#E8EDFF] text-[#0F1E36]',
        },
        {
          id: 'progress',
          label: 'Work Progress',
          icon: CheckSquare,
          badge: `${activeStreamsCount} active`,
          badgeColor: 'bg-[#E8EDFF] text-[#0F1E36]',
        },
        { id: 'labour', label: 'Labour & Workforce', icon: Users },
      ],
    },
    {
      title: 'LOGISTICS & COSTS',
      items: [
        { id: 'transport', label: 'Transportation', icon: Truck },
        { id: 'expenses', label: 'Other Expenses', icon: Receipt },
        { id: 'budget', label: 'Budget & Cost Control', icon: PieChart },
      ],
    },
    {
      title: 'INSIGHTS & ADMIN',
      items: [
        { id: 'reports', label: 'Audit Reports & CSV', icon: FileText },
        { id: 'settings', label: 'Project Settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 bg-white border-r border-[#E8EDFF] h-[calc(100vh-4rem)] sticky top-16 select-none overflow-y-auto">
      {/* Site Quick Snapshot Card */}
      <div className="p-4 border-b border-[#E8EDFF]">
        <div className="bg-[#F1F3FF] p-3 rounded-xl border border-[#E0E8FF]">
          <div className="flex items-center justify-between text-xs text-[#75777E] mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Site Budget Cap</span>
            <span className="font-mono text-[#081B38] font-bold">
              {project?.budgetCap ? formatNairaCompact(project.budgetCap) : '₦27.0M'}
            </span>
          </div>
          <div className="text-sm font-bold text-[#081B38] truncate">{project?.name || 'Finishing Project'}</div>
          <div className="mt-2 text-[11px] text-[#44474D] flex items-center justify-between">
            <span>Spent to Date:</span>
            <span className="font-mono font-bold text-[#0F1E36]">{formatNairaCompact(totalSpent)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            onClick={onOpenPurchaseModal}
            className="w-full py-2 px-2 bg-[#0F1E36] hover:bg-[#1A2B49] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>Purchase</span>
          </button>
          <button
            onClick={onOpenUsageModal}
            className="w-full py-2 px-2 bg-[#6B46C1] hover:bg-[#553C9A] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>Usage</span>
          </button>
        </div>
      </div>

      {/* Nav groups */}
      <div className="p-3 space-y-5 flex-1">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-[#75777E] tracking-wider uppercase">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#000412] text-white shadow-xs'
                        : 'text-[#44474D] hover:bg-[#F1F3FF] hover:text-[#081B38]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon size={16} className={isActive ? 'text-white' : 'text-[#75777E]'} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold tracking-tight ${
                          isActive ? 'bg-white/20 text-white' : item.badgeColor
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-[#E8EDFF] text-[11px] text-[#75777E] flex items-center justify-between">
        <span>Lagos Finishing Sync</span>
        <span className="inline-flex items-center gap-1 text-[#059669] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse"></span>
          Live
        </span>
      </div>
    </aside>
  );
};
