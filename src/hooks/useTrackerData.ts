import { useState, useEffect, useCallback } from 'react';
import {
  ConstructionTrackerService,
  STORAGE_UPDATE_EVENT,
} from '../services/storage';
import {
  ProjectSettings,
  Material,
  PurchaseRecord,
  MaterialUsage,
  WorkProgressItem,
  Contractor,
  LabourPayment,
  TransportationRecord,
  OtherExpenseRecord,
  AuditEvent,
  AggregatedMetrics,
} from '../types';

export function useTrackerData() {
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    ConstructionTrackerService.initialize();

    const handleUpdate = () => {
      setDataVersion((v) => v + 1);
    };

    window.addEventListener(STORAGE_UPDATE_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(STORAGE_UPDATE_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const project: ProjectSettings = ConstructionTrackerService.getProject();
  const projects: ProjectSettings[] = ConstructionTrackerService.getProjects();
  const activeProjectId: string = ConstructionTrackerService.getActiveProjectId();
  const materials: Material[] = ConstructionTrackerService.getMaterials();
  const purchases: PurchaseRecord[] = ConstructionTrackerService.getPurchases();
  const usage: MaterialUsage[] = ConstructionTrackerService.getMaterialUsage();
  const workProgress: WorkProgressItem[] = ConstructionTrackerService.getWorkProgress();
  const contractors: Contractor[] = ConstructionTrackerService.getContractors();
  const labourPayments: LabourPayment[] = ConstructionTrackerService.getLabourPayments();
  const transportation: TransportationRecord[] = ConstructionTrackerService.getTransportation();
  const otherExpenses: OtherExpenseRecord[] = ConstructionTrackerService.getOtherExpenses();
  const metrics: AggregatedMetrics = ConstructionTrackerService.getAggregatedMetrics();
  const auditEvents: AuditEvent[] = ConstructionTrackerService.getAuditEvents();
  const currentUser = ConstructionTrackerService.getCurrentUser();
  const userProfile = ConstructionTrackerService.getUserProfile();
  const syncStatus = ConstructionTrackerService.getSyncStatus();
  const lastError = ConstructionTrackerService.getLastError();

  const refresh = useCallback(() => {
    setDataVersion((v) => v + 1);
  }, []);

  return {
    dataVersion,
    refresh,
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
    otherExpenses,
    expenses: otherExpenses,
    metrics,
    auditEvents,
    currentUser,
    userProfile,
    syncStatus,
    lastError,
    clearError: ConstructionTrackerService.clearError.bind(ConstructionTrackerService),
    switchProject: ConstructionTrackerService.switchProject.bind(ConstructionTrackerService),
    createProject: ConstructionTrackerService.createProject.bind(ConstructionTrackerService),
    deleteProject: ConstructionTrackerService.deleteProject.bind(ConstructionTrackerService),
    loading: false,
    // Service helpers
    saveMaterial: ConstructionTrackerService.saveMaterial.bind(ConstructionTrackerService),
    deleteMaterial: ConstructionTrackerService.deleteMaterial.bind(ConstructionTrackerService),
    savePurchase: ConstructionTrackerService.savePurchase.bind(ConstructionTrackerService),
    deletePurchase: ConstructionTrackerService.deletePurchase.bind(ConstructionTrackerService),
    saveUsage: ConstructionTrackerService.saveUsage.bind(ConstructionTrackerService),
    deleteUsage: ConstructionTrackerService.deleteUsage.bind(ConstructionTrackerService),
    saveWorkProgress: ConstructionTrackerService.saveWorkProgress.bind(ConstructionTrackerService),
    saveWorkItem: ConstructionTrackerService.saveWorkProgress.bind(ConstructionTrackerService),
    updateWorkPercent: ConstructionTrackerService.updateWorkPercent.bind(ConstructionTrackerService),
    deleteWorkProgress: ConstructionTrackerService.deleteWorkProgress.bind(ConstructionTrackerService),
    deleteWorkItem: ConstructionTrackerService.deleteWorkProgress.bind(ConstructionTrackerService),
    saveContractor: ConstructionTrackerService.saveContractor.bind(ConstructionTrackerService),
    deleteContractor: ConstructionTrackerService.deleteContractor.bind(ConstructionTrackerService),
    saveLabourPayment: ConstructionTrackerService.saveLabourPayment.bind(ConstructionTrackerService),
    deleteLabourPayment: ConstructionTrackerService.deleteLabourPayment.bind(ConstructionTrackerService),
    saveTransportation: ConstructionTrackerService.saveTransportation.bind(ConstructionTrackerService),
    deleteTransportation: ConstructionTrackerService.deleteTransportation.bind(ConstructionTrackerService),
    saveOtherExpense: ConstructionTrackerService.saveOtherExpense.bind(ConstructionTrackerService),
    deleteOtherExpense: ConstructionTrackerService.deleteOtherExpense.bind(ConstructionTrackerService),
    updateCategoryBudget: ConstructionTrackerService.updateCategoryBudget.bind(ConstructionTrackerService),
    updateProject: ConstructionTrackerService.updateProject.bind(ConstructionTrackerService),
    updateProjectSettings: ConstructionTrackerService.updateProject.bind(ConstructionTrackerService),
    resetToSeedData: ConstructionTrackerService.resetToSeedData.bind(ConstructionTrackerService),
    clearAllData: ConstructionTrackerService.clearAllData.bind(ConstructionTrackerService),
    exportDatabaseJSON: ConstructionTrackerService.exportDatabaseJSON.bind(ConstructionTrackerService),
    importDatabaseJSON: ConstructionTrackerService.importDatabaseJSON.bind(ConstructionTrackerService),
    signIn: ConstructionTrackerService.signIn.bind(ConstructionTrackerService),
    signUp: ConstructionTrackerService.signUp.bind(ConstructionTrackerService),
    logout: ConstructionTrackerService.logout.bind(ConstructionTrackerService),
  };
}
