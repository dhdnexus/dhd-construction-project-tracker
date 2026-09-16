import React, { useState } from 'react';
import { AppLogo } from '../common/AppLogo';
import {
  Bell,
  MoreVertical,
  User,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Plus,
  Building,
  Cloud,
  CloudOff,
  Loader2,
} from 'lucide-react';
import { ProjectSettings, SyncStatus, UserProfile } from '../../types';

interface HeaderProps {
  currentTab: string;
  project: ProjectSettings;
  lowStockCount: number;
  outstandingTotal: string;
  syncStatus?: SyncStatus;
  userProfile?: UserProfile;
  lastError?: string | null;
  onClearError?: () => void;
  onOpenPurchaseModal: () => void;
  onOpenUsageModal: () => void;
  onOpenAuthModal?: () => void;
  onOpenProjectModal?: () => void;
  onResetData: () => void;
  onExportJSON: () => void;
  onNavigate: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  project,
  lowStockCount,
  outstandingTotal,
  syncStatus = 'synced',
  userProfile,
  lastError,
  onClearError,
  onOpenPurchaseModal,
  onOpenUsageModal,
  onOpenAuthModal,
  onOpenProjectModal,
  onResetData,
  onExportJSON,
  onNavigate,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);

  const getTabLabel = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return 'Dashboard';
      case 'materials':
        return 'Materials Inventory';
      case 'progress':
        return 'Progress Milestones';
      case 'labour':
        return 'Labour Workforce';
      case 'transport':
        return 'Transportation';
      case 'expenses':
        return 'Other Expenses';
      case 'budget':
        return 'Budget And Expenses';
      case 'reports':
        return 'Project Reports';
      case 'settings':
        return 'Project Settings';
      default:
        return 'Dashboard';
    }
  };

  const isAuthUser = userProfile && !userProfile.isAnonymous && !!userProfile.email;

  return (
    <header className="fixed top-0 w-full z-40 bg-[#F9F9FF]/95 backdrop-blur-xl border-b border-[#E8EDFF] shadow-[0_1px_8px_rgba(0,0,0,0.03)] pt-safe">
      <div className="h-16 max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
        {/* Left: Brand Identity & Active Project */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
            aria-label="Go to Dashboard"
          >
            <AppLogo size={34} />
          </button>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#081B38] text-[15px] sm:text-base truncate leading-tight tracking-tight">
                Construction Project Tracker
              </span>

              {/* Sync Status indicator */}
              <div className="hidden sm:flex items-center">
                {syncStatus === 'saving' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6B46C1] bg-[#F3E8FF] px-2 py-0.5 rounded-full">
                    <Loader2 size={10} className="animate-spin" />
                    <span>Saving...</span>
                  </span>
                )}
                {syncStatus === 'synced' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded-full">
                    <Cloud size={11} />
                    <span>Live</span>
                  </span>
                )}
                {syncStatus === 'offline' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded-full">
                    <CloudOff size={11} />
                    <span>Offline</span>
                  </span>
                )}
                {syncStatus === 'error' && (
                  <button
                    onClick={onClearError}
                    title={lastError || 'Sync issue'}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#DC2626] bg-[#FEE2E2] px-2 py-0.5 rounded-full hover:bg-[#FECACA] cursor-pointer"
                  >
                    <AlertTriangle size={11} />
                    <span>Sync Error</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              {/* Project selector badge */}
              {onOpenProjectModal ? (
                <button
                  type="button"
                  onClick={onOpenProjectModal}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#E0E8FF] hover:bg-[#D0DEFF] text-[#0F1E36] text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  title="Switch or create project"
                >
                  <Building size={10} />
                  <span className="truncate max-w-[130px] sm:max-w-[180px]">{project?.name || 'Finishing Site'}</span>
                  <span className="opacity-60">{project?.code}</span>
                </button>
              ) : (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#E0E8FF] text-[#0F1E36] text-[10px] font-bold uppercase tracking-wider">
                  {project?.name || 'Finishing Phase'} • {project?.code || 'Site'}
                </span>
              )}

              <span className="text-[#75777E] hidden sm:inline">•</span>
              <span className="text-[#75777E] font-medium truncate hidden sm:inline">
                {getTabLabel(currentTab)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Controls */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 relative">
          {/* Quick Add on Desktop */}
          <div className="hidden md:flex items-center gap-1.5 mr-1">
            <button
              onClick={onOpenPurchaseModal}
              className="h-9 px-3 rounded-lg bg-[#0F1E36] hover:bg-[#1A2B49] text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={15} />
              <span>Purchase</span>
            </button>
            <button
              onClick={onOpenUsageModal}
              className="h-9 px-3 rounded-lg bg-[#6B46C1] hover:bg-[#553C9A] text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={15} />
              <span>Usage</span>
            </button>
          </div>

          {/* Notifications Trigger */}
          <div className="relative">
            <button
              aria-label="Project Notifications"
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowQuickMenu(false);
              }}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-[#44474D] hover:text-[#081B38] hover:bg-[#E8EDFF] transition-colors relative cursor-pointer"
            >
              <Bell size={20} />
              {(lowStockCount > 0 || outstandingTotal !== '₦0') && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#6B46C1] ring-2 ring-[#F9F9FF]"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-xl border border-[#E8EDFF] p-3 z-50 text-sm animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E8EDFF]">
                  <span className="font-bold text-[#081B38] text-xs uppercase tracking-wider">
                    Site Alerts & Activity
                  </span>
                  <span className="text-[11px] bg-[#E0E8FF] text-[#0F1E36] px-1.5 py-0.5 rounded font-bold">
                    Active
                  </span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {lowStockCount > 0 && (
                    <div className="p-2.5 rounded-lg bg-[#FFFBEB] text-[#92400E] flex items-start gap-2 border border-[#FDE68A]">
                      <AlertTriangle size={16} className="text-[#D97706] shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-bold block">Critical Supply Alert</span>
                        <span>{lowStockCount} material items critically low on site. Replenish immediately.</span>
                      </div>
                    </div>
                  )}
                  <div className="p-2.5 rounded-lg bg-[#F1F3FF] text-[#081B38] flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-[#6B46C1] shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-bold block">Finishing Snagging Active</span>
                      <span>POP Ceiling bulkheads inspected today at 08:45 AM.</span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#FFDAD6]/60 text-[#93000A] flex items-start gap-2">
                    <AlertTriangle size={16} className="text-[#BA1A1A] shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-bold block">Outstanding Balance Notice</span>
                      <span>Total outstanding payables: {outstandingTotal}.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Menu Button */}
          <div className="relative">
            <button
              aria-label="Quick Menu"
              onClick={() => {
                setShowQuickMenu(!showQuickMenu);
                setShowNotifications(false);
              }}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-[#44474D] hover:text-[#081B38] hover:bg-[#E8EDFF] transition-colors cursor-pointer"
            >
              <MoreVertical size={20} />
            </button>

            {showQuickMenu && (
              <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-xl border border-[#E8EDFF] p-1.5 z-50 text-sm animate-in fade-in zoom-in-95 duration-150">
                {onOpenProjectModal && (
                  <button
                    onClick={() => {
                      onOpenProjectModal();
                      setShowQuickMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[#081B38] hover:bg-[#E8EDFF] rounded-lg cursor-pointer"
                  >
                    <Building size={16} className="text-[#0F1E36]" />
                    <span>Projects & Sites</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    onOpenPurchaseModal();
                    setShowQuickMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[#081B38] hover:bg-[#E8EDFF] rounded-lg cursor-pointer"
                >
                  <Plus size={16} className="text-[#0F1E36]" />
                  <span>+ Add Purchase</span>
                </button>
                <button
                  onClick={() => {
                    onOpenUsageModal();
                    setShowQuickMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[#081B38] hover:bg-[#E8EDFF] rounded-lg cursor-pointer"
                >
                  <Plus size={16} className="text-[#6B46C1]" />
                  <span>+ Record Usage</span>
                </button>
                <button
                  onClick={() => {
                    onNavigate('reports');
                    setShowQuickMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[#081B38] hover:bg-[#E8EDFF] rounded-lg cursor-pointer"
                >
                  <Download size={16} />
                  <span>Generate Report / CSV</span>
                </button>
                <div className="my-1 border-t border-[#E8EDFF]"></div>
                <button
                  onClick={() => {
                    onExportJSON();
                    setShowQuickMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[#081B38] hover:bg-[#E8EDFF] rounded-lg cursor-pointer"
                >
                  <Download size={16} />
                  <span>Backup Database (JSON)</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm('Reset database to demo finishing site records? Any unsaved edits will be refreshed.')) {
                      onResetData();
                    }
                    setShowQuickMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[#D97706] hover:bg-[#FFFBEB] rounded-lg cursor-pointer"
                >
                  <RefreshCw size={16} />
                  <span>Reset Demo Data</span>
                </button>
              </div>
            )}
          </div>

          {/* User Account Button */}
          <button
            onClick={() => {
              if (onOpenAuthModal) onOpenAuthModal();
              else onNavigate('settings');
            }}
            title={isAuthUser ? `Signed in as ${userProfile.email}` : 'Sign In / User Profile'}
            className={`h-8 px-2.5 rounded-full flex items-center gap-1.5 text-xs font-bold ml-0.5 cursor-pointer transition-all ${
              isAuthUser
                ? 'bg-[#DCFCE7] text-[#15803D] hover:bg-[#BBF7D0] border border-[#86EFAC]'
                : 'bg-[#000412] text-white hover:bg-[#0F1E36]'
            }`}
          >
            <User size={14} />
            <span className="hidden sm:inline max-w-[90px] truncate">
              {isAuthUser ? userProfile.displayName || userProfile.email?.split('@')[0] : 'Sign In'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
