import React, { useState, useEffect } from 'react';
import { useTrackerData } from './hooks/useTrackerData';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';

// Pages
import { DashboardView } from './pages/DashboardView';
import { MaterialsView } from './pages/MaterialsView';
import { ProgressView } from './pages/ProgressView';
import { LabourView } from './pages/LabourView';
import { TransportView } from './pages/TransportView';
import { ExpensesView } from './pages/ExpensesView';
import { BudgetView } from './pages/BudgetView';
import { ReportsView } from './pages/ReportsView';
import { SettingsView } from './pages/SettingsView';

// Modals
import { PurchaseModal } from './components/modals/PurchaseModal';
import { UsageModal } from './components/modals/UsageModal';
import { LabourPaymentModal } from './components/modals/LabourPaymentModal';
import { TransportModal } from './components/modals/TransportModal';
import { ExpenseModal } from './components/modals/ExpenseModal';
import { WorkStreamModal } from './components/modals/WorkStreamModal';
import { ContractorModal } from './components/modals/ContractorModal';
import { ConfirmDeleteModal } from './components/modals/ConfirmDeleteModal';
import { AuthModal } from './components/modals/AuthModal';
import { ProjectModal } from './components/modals/ProjectModal';

import {
  PurchaseRecord,
  MaterialUsage,
  LabourPayment,
  TransportationRecord,
  OtherExpenseRecord,
  WorkProgressItem,
  Contractor,
} from './types';
import { Check, AlertCircle, Building, Plus } from 'lucide-react';
import { formatNairaCompact } from './utils/formatters';

export default function App() {
  const {
    project,
    projects,
    activeProjectId,
    materials,
    purchases,
    usage,
    workProgress,
    contractors,
    labourPayments,
    transportation,
    expenses,
    metrics,
    loading,
    userProfile,
    syncStatus,
    lastError,
    clearError,
    switchProject,
    createProject,
    deleteProject,
    signIn,
    signUp,
    logout,
    savePurchase,
    deletePurchase,
    saveUsage,
    deleteUsage,
    deleteMaterial,
    saveWorkItem,
    updateWorkPercent,
    deleteWorkItem,
    saveContractor,
    deleteContractor,
    saveLabourPayment,
    deleteLabourPayment,
    saveTransportation,
    deleteTransportation,
    saveOtherExpense,
    deleteOtherExpense,
    updateCategoryBudget,
    updateProjectSettings,
    resetToSeedData,
    clearAllData,
    exportDatabaseJSON,
    auditEvents,
  } = useTrackerData();

  // Multi-project & Auth Modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);

  // Active Tab state (synced with hash if present)
  const [activeTab, setActiveTab] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '');
    const validTabs = [
      'dashboard',
      'materials',
      'progress',
      'labour',
      'transport',
      'expenses',
      'budget',
      'reports',
      'settings',
    ];
    return validTabs.includes(hash) ? hash : 'dashboard';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) setActiveTab(hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
    window.location.hash = tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Modals state
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRecord | null>(null);

  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [selectedUsage, setSelectedUsage] = useState<MaterialUsage | null>(null);
  const [defaultUsageMaterialId, setDefaultUsageMaterialId] = useState<string | undefined>(undefined);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<LabourPayment | null>(null);
  const [defaultPaymentContractorId, setDefaultPaymentContractorId] = useState<string | undefined>(
    undefined
  );

  const [transportModalOpen, setTransportModalOpen] = useState(false);
  const [selectedTransport, setSelectedTransport] = useState<TransportationRecord | null>(null);

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<OtherExpenseRecord | null>(null);

  const [workStreamModalOpen, setWorkStreamModalOpen] = useState(false);
  const [selectedWorkStream, setSelectedWorkStream] = useState<WorkProgressItem | null>(null);

  const [contractorModalOpen, setContractorModalOpen] = useState(false);
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);

  // Delete confirmation modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    itemName?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F9FF] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-3 border-[#0F1E36] border-t-transparent rounded-full animate-spin" />
        <p className="font-mono text-xs font-bold text-[#081B38] tracking-wider uppercase">
          Initializing Construction Project Tracker...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F9FF] flex">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-60 bg-[#000412] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-bold border border-[#E8EDFF]/20 animate-in slide-in-from-top-2 fade-in duration-150">
          <div className="w-5 h-5 rounded-full bg-[#059669] flex items-center justify-center text-white shrink-0">
            <Check size={13} />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Fixed Top Header */}
      <Header
        currentTab={activeTab}
        project={project}
        lowStockCount={metrics.lowStockCount}
        outstandingTotal={metrics.totalOutstanding ? formatNairaCompact(metrics.totalOutstanding) : '₦0'}
        syncStatus={syncStatus}
        userProfile={userProfile}
        lastError={lastError}
        onClearError={clearError}
        onOpenPurchaseModal={() => {
          setSelectedPurchase(null);
          setPurchaseModalOpen(true);
        }}
        onOpenUsageModal={() => {
          setSelectedUsage(null);
          setDefaultUsageMaterialId(undefined);
          setUsageModalOpen(true);
        }}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onOpenProjectModal={() => setProjectModalOpen(true)}
        onResetData={() => {
          resetToSeedData();
          showToast('Demo data restored.');
        }}
        onExportJSON={() => {
          const json = exportDatabaseJSON();
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
          showToast('Site database backup exported.');
        }}
        onNavigate={handleNavigate}
      />

      {/* Main Layout Area below Header */}
      <div className="flex flex-1 pt-16 min-h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar */}
        <Sidebar
          currentTab={activeTab}
          onNavigate={handleNavigate}
          project={project}
          materialsCount={materials.length}
          lowStockCount={metrics.lowStockCount}
          activeStreamsCount={workProgress.filter((w) => w.status === 'In Progress').length}
          totalSpent={metrics.totalSpent}
          onOpenPurchaseModal={() => {
            setSelectedPurchase(null);
            setPurchaseModalOpen(true);
          }}
          onOpenUsageModal={() => {
            setSelectedUsage(null);
            setDefaultUsageMaterialId(undefined);
            setUsageModalOpen(true);
          }}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-28 md:pb-12 min-w-0">
          {projects.length === 0 && activeTab !== 'settings' ? (
            <div className="flex items-center justify-center min-h-[60vh] py-8">
              <div className="max-w-md w-full bg-white rounded-3xl border border-[#E8EDFF] p-8 text-center shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-[#F1F3FF] text-[#081B38] mx-auto flex items-center justify-center mb-5">
                  <Building size={32} />
                </div>
                <h2 className="text-xl font-bold text-[#081B38] tracking-tight mb-2">
                  No Active Project Workspace
                </h2>
                <p className="text-sm text-[#75777E] leading-relaxed mb-6">
                  Create your first construction project workspace to start tracking materials, labor disbursements, and landed expenses without demo pollution.
                </p>
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => setProjectModalOpen(true)}
                    className="w-full py-3 px-5 bg-[#000412] hover:bg-[#0F1E36] text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Plus size={16} />
                    <span>Create Your First Project</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetToSeedData();
                      showToast('Sample demo project initialized.');
                    }}
                    className="w-full py-2.5 px-4 bg-[#F1F3FF] hover:bg-[#E0E8FF] text-[#081B38] text-xs font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Load Sample Demo Project
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  project={project}
                  metrics={metrics}
                  purchases={purchases}
                  usage={usage}
                  workProgress={workProgress}
                  contractors={contractors}
                  labourPayments={labourPayments}
                  onNavigate={handleNavigate}
                  onOpenPurchaseModal={() => {
                    setSelectedPurchase(null);
                    setPurchaseModalOpen(true);
                  }}
                  onOpenUsageModal={() => {
                    setSelectedUsage(null);
                    setDefaultUsageMaterialId(undefined);
                    setUsageModalOpen(true);
                  }}
                  onOpenPaymentModal={() => {
                    setSelectedPayment(null);
                    setDefaultPaymentContractorId(undefined);
                    setPaymentModalOpen(true);
                  }}
                />
              )}

          {activeTab === 'materials' && (
            <MaterialsView
              materials={materials}
              purchases={purchases}
              usage={usage}
              stockValue={metrics.stockInStoreValue}
              lowStockCount={metrics.lowStockCount}
              onOpenPurchaseModal={(pur) => {
                setSelectedPurchase(pur || null);
                setPurchaseModalOpen(true);
              }}
              onOpenUsageModal={(matId, u) => {
                setSelectedUsage(u || null);
                setDefaultUsageMaterialId(matId);
                setUsageModalOpen(true);
              }}
              onDeletePurchase={(id, name) => {
                setDeleteModal({
                  isOpen: true,
                  title: 'Delete Purchase Record?',
                  message:
                    'Deleting this purchase will reverse the inventory stock quantities and adjust the landed cost ledger.',
                  itemName: name,
                  onConfirm: () => {
                    deletePurchase(id);
                    showToast('Purchase record removed & stock recalculated.');
                  },
                });
              }}
              onDeleteUsage={(id, name) => {
                setDeleteModal({
                  isOpen: true,
                  title: 'Delete Usage Record?',
                  message:
                    'Deleting this usage dispensation will return the deducted quantity back to the in-store inventory stock balance.',
                  itemName: name,
                  onConfirm: () => {
                    deleteUsage(id);
                    showToast('Usage record removed & stock restored.');
                  },
                });
              }}
              onDeleteMaterial={(id, name) => {
                setDeleteModal({
                  isOpen: true,
                  title: 'Delete Material Category?',
                  message:
                    'Are you sure you want to remove this material item from the site inventory registry?',
                  itemName: name,
                  onConfirm: () => {
                    deleteMaterial(id);
                    showToast('Material removed from registry.');
                  },
                });
              }}
            />
          )}

          {activeTab === 'progress' && (
            <ProgressView
              workProgress={workProgress}
              onOpenWorkStreamModal={(stream) => {
                setSelectedWorkStream(stream || null);
                setWorkStreamModalOpen(true);
              }}
              onUpdateWorkPercent={(id, pct) => {
                updateWorkPercent(id, pct);
                showToast(`Work stream updated to ${pct}% completion.`);
              }}
              onDeleteWorkStream={(id, name) => {
                setDeleteModal({
                  isOpen: true,
                  title: 'Delete Finishing Stream?',
                  message: 'This will remove the milestone tracking stream from the master schedule.',
                  itemName: name,
                  onConfirm: () => {
                    deleteWorkItem(id);
                    showToast('Work stream deleted.');
                  },
                });
              }}
            />
          )}

          {activeTab === 'labour' && (
            <LabourView
              contractors={contractors}
              labourPayments={labourPayments}
              onOpenContractorModal={(cont) => {
                setSelectedContractor(cont || null);
                setContractorModalOpen(true);
              }}
              onOpenPaymentModal={(contractorId, payment) => {
                setSelectedPayment(payment || null);
                setDefaultPaymentContractorId(contractorId);
                setPaymentModalOpen(true);
              }}
              onDeleteContractor={(id, name) => {
                setDeleteModal({
                  isOpen: true,
                  title: 'Delete Subcontractor?',
                  message:
                    'Removing this contractor will also unlink associated milestone records. Proceed with caution.',
                  itemName: name,
                  onConfirm: () => {
                    deleteContractor(id);
                    showToast('Contractor removed from ledger.');
                  },
                });
              }}
              onDeletePayment={(id, title) => {
                setDeleteModal({
                  isOpen: true,
                  title: 'Delete Payment Disbursement?',
                  message:
                    'This will reverse the payment entry and restore the contractor outstanding balance.',
                  itemName: title,
                  onConfirm: () => {
                    deleteLabourPayment(id);
                    showToast('Disbursement reversed & contractor balance restored.');
                  },
                });
              }}
            />
          )}

          {activeTab === 'transport' && (
            <TransportView
              transportation={transportation}
              onOpenTransportModal={(t) => {
                setSelectedTransport(t || null);
                setTransportModalOpen(true);
              }}
              onDeleteTransport={(id, item) => {
                setDeleteModal({
                  isOpen: true,
                  title: 'Delete Haulage Record?',
                  message: 'This will remove the transportation record and adjust the logistics ledger.',
                  itemName: item,
                  onConfirm: () => {
                    deleteTransportation(id);
                    showToast('Haulage trip deleted.');
                  },
                });
              }}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesView
              expenses={expenses}
              onOpenExpenseModal={(exp) => {
                setSelectedExpense(exp || null);
                setExpenseModalOpen(true);
              }}
              onDeleteExpense={(id, desc) => {
                setDeleteModal({
                  isOpen: true,
                  title: 'Delete Site Expense?',
                  message: 'This will remove the expense entry from the site ledger.',
                  itemName: desc,
                  onConfirm: () => {
                    deleteOtherExpense(id);
                    showToast('Expense entry deleted.');
                  },
                });
              }}
            />
          )}

          {activeTab === 'budget' && (
            <BudgetView
              project={project}
              budgetCategories={metrics.budgetCategories}
              totalSpent={metrics.totalSpent}
              budgetCap={metrics.budgetCap}
              remainingBuffer={metrics.remainingBuffer}
              contingencyPercent={metrics.contingencyPercent}
              totalOutstanding={metrics.totalOutstanding}
              onUpdateCategoryBudget={(catId, newBudget) => {
                updateCategoryBudget(catId, newBudget);
                showToast('Category budget allocation updated.');
              }}
              onUpdateBudgetCap={(newCap) => {
                updateProjectSettings({ budgetCap: newCap });
                showToast('Approved budget ceiling updated.');
              }}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              project={project}
              metrics={metrics}
              purchases={purchases}
              usage={usage}
              workProgress={workProgress}
              contractors={contractors}
              labourPayments={labourPayments}
              transportation={transportation}
              expenses={expenses}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              project={project}
              projects={projects}
              activeProjectId={activeProjectId}
              userProfile={userProfile}
              auditEvents={auditEvents}
              onUpdateProject={(updates) => {
                updateProjectSettings(updates);
                showToast('Project configuration saved.');
              }}
              onSwitchProject={async (id) => {
                await switchProject(id);
                showToast('Switched active project.');
              }}
              onCreateProject={async (data) => {
                const newP = await createProject(data);
                showToast(`Project "${newP.name}" created.`);
                return newP;
              }}
              onDeleteProject={async (id) => {
                await deleteProject(id);
                showToast('Project removed.');
              }}
              onResetSeedData={() => {
                resetToSeedData();
                showToast('Demo data successfully restored.');
              }}
              onClearAllData={() => {
                clearAllData();
                showToast('Site data wiped.');
              }}
              onOpenAuthModal={() => setAuthModalOpen(true)}
            />
          )}
          </>
        )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav currentTab={activeTab} onNavigate={handleNavigate} />

      {/* MODALS */}
      <PurchaseModal
        isOpen={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        onSave={(data) => {
          savePurchase(data);
          showToast(selectedPurchase ? 'Purchase record updated.' : 'Purchase logged & inventory updated.');
        }}
        existingMaterials={materials}
        initialData={selectedPurchase}
      />

      <UsageModal
        isOpen={usageModalOpen}
        onClose={() => setUsageModalOpen(false)}
        onSave={(data) => {
          saveUsage(data);
          showToast(selectedUsage ? 'Usage record updated.' : 'Material dispatched & stock deducted.');
        }}
        materials={materials}
        initialData={selectedUsage}
        defaultMaterialId={defaultUsageMaterialId}
      />

      <LabourPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSave={(data) => {
          saveLabourPayment(data);
          showToast(selectedPayment ? 'Payment updated.' : 'Disbursement recorded & balance updated.');
        }}
        contractors={contractors}
        initialData={selectedPayment}
        defaultContractorId={defaultPaymentContractorId}
      />

      <TransportModal
        isOpen={transportModalOpen}
        onClose={() => setTransportModalOpen(false)}
        onSave={(data) => {
          saveTransportation(data);
          showToast(selectedTransport ? 'Haulage trip updated.' : 'Haulage record saved.');
        }}
        initialData={selectedTransport}
      />

      <ExpenseModal
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        onSave={(data) => {
          saveOtherExpense(data);
          showToast(selectedExpense ? 'Expense record updated.' : 'Expense recorded.');
        }}
        initialData={selectedExpense}
      />

      <WorkStreamModal
        isOpen={workStreamModalOpen}
        onClose={() => setWorkStreamModalOpen(false)}
        onSave={(data) => {
          saveWorkItem(data);
          showToast(selectedWorkStream ? 'Finishing stream updated.' : 'Work stream created.');
        }}
        initialData={selectedWorkStream}
      />

      <ContractorModal
        isOpen={contractorModalOpen}
        onClose={() => setContractorModalOpen(false)}
        onSave={(data) => {
          saveContractor(data);
          showToast(selectedContractor ? 'Contractor terms updated.' : 'Subcontractor onboarded.');
        }}
        initialData={selectedContractor}
      />

      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={deleteModal.onConfirm}
        title={deleteModal.title}
        message={deleteModal.message}
        itemName={deleteModal.itemName}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        userProfile={userProfile}
        onSignIn={signIn}
        onSignUp={signUp}
        onLogout={logout}
      />

      <ProjectModal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitchProject={async (id) => {
          await switchProject(id);
          showToast('Switched active project.');
        }}
        onCreateProject={async (data) => {
          const newP = await createProject(data);
          showToast(`Project "${newP.name}" created.`);
          return newP;
        }}
      />
    </div>
  );
}
