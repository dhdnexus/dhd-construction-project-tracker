import React, { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  CheckSquare,
  Users,
  Grid,
  Truck,
  Receipt,
  PieChart,
  FileText,
  Settings,
  X,
} from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onNavigate }) => {
  const [showMoreDrawer, setShowMoreDrawer] = useState(false);

  const primaryNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'materials', label: 'Materials', icon: Package },
    { id: 'progress', label: 'Progress', icon: CheckSquare },
    { id: 'labour', label: 'Labour', icon: Users },
    { id: 'more', label: 'More', icon: Grid },
  ];

  const moreItems = [
    {
      id: 'transport',
      label: 'Transportation',
      desc: 'Haulage, logistics & tippers',
      icon: Truck,
      color: 'bg-[#E8EDFF] text-[#0F1E36]',
    },
    {
      id: 'expenses',
      label: 'Other Expenses',
      desc: 'Fuel, tools, security & sundry',
      icon: Receipt,
      color: 'bg-[#E8EDFF] text-[#0F1E36]',
    },
    {
      id: 'budget',
      label: 'Budget & Costs',
      desc: 'Fiscal ledger & variance analysis',
      icon: PieChart,
      color: 'bg-[#E8EDFF] text-[#6B46C1]',
    },
    {
      id: 'reports',
      label: 'Reports & Export',
      desc: 'PDF statements, CSV and audit logs',
      icon: FileText,
      color: 'bg-[#E8EDFF] text-[#0F1E36]',
    },
    {
      id: 'settings',
      label: 'Project Settings',
      desc: 'Site parameters, budget caps & backups',
      icon: Settings,
      color: 'bg-[#E8EDFF] text-[#0F1E36]',
    },
  ];

  const handleNavClick = (id: string) => {
    if (id === 'more') {
      setShowMoreDrawer(true);
    } else {
      setShowMoreDrawer(false);
      onNavigate(id);
    }
  };

  const handleMoreItemClick = (id: string) => {
    setShowMoreDrawer(false);
    onNavigate(id);
  };

  const isMoreActive = ['transport', 'expenses', 'budget', 'reports', 'settings'].includes(currentTab);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 pb-safe bg-[#F9F9FF]/95 backdrop-blur-xl border-t border-[#E8EDFF] shadow-[0_-1px_12px_rgba(0,0,0,0.06)] md:hidden">
        <div className="flex justify-around items-center h-16 px-1 max-w-lg mx-auto">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === 'more' ? isMoreActive : currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] h-full flex-1 transition-colors cursor-pointer ${
                  isActive ? 'text-[#000412] font-bold' : 'text-[#44474D] hover:text-[#081B38]'
                }`}
              >
                <div className={`relative p-1 rounded-full ${isActive ? 'bg-[#E0E8FF]' : ''}`}>
                  <Icon size={20} className={isActive ? 'text-[#000412]' : 'text-[#44474D]'} />
                </div>
                <span className="text-[11px] font-semibold tracking-tight mt-0.5">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Slide-over More Hub Modal / Drawer */}
      {showMoreDrawer && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[#0F1E36]/50 backdrop-blur-xs md:hidden animate-in fade-in duration-200">
          <div
            className="flex-1"
            onClick={() => setShowMoreDrawer(false)}
          />
          <div className="bg-white rounded-t-2xl p-5 shadow-2xl border-t border-[#E8EDFF] space-y-4 max-h-[80vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between pb-1 border-b border-[#E8EDFF]">
              <div>
                <h3 className="text-base font-bold text-[#081B38]">More Operations</h3>
                <p className="text-xs text-[#75777E]">Cost tracking, logistics and reporting</p>
              </div>
              <button
                onClick={() => setShowMoreDrawer(false)}
                className="w-8 h-8 rounded-full bg-[#F1F3FF] flex items-center justify-center text-[#44474D] hover:text-[#081B38]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleMoreItemClick(item.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl text-left transition-colors cursor-pointer border ${
                      isActive
                        ? 'bg-[#E8EDFF] border-[#6B46C1] text-[#081B38]'
                        : 'bg-[#F9F9FF] border-[#E8EDFF] hover:bg-[#F1F3FF] text-[#081B38]'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center shrink-0`}>
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm leading-snug">{item.label}</div>
                      <div className="text-xs text-[#75777E] leading-tight mt-0.5">{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
