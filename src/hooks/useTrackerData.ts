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

  const project = ConstructionTrackerService.getProject();
  const materials = ConstructionTrackerService.getMaterials();
  const purchases = ConstructionTrackerService.getPurchases();
  const usage = ConstructionTrackerService.getMaterialUsage();
  const workProgress = ConstructionTrackerService.getWorkProgress();
  const contractors = ConstructionTrackerService.getContractors();
  const labourPayments = ConstructionTrackerService.getLabourPayments();
  const transportation = ConstructionTrackerService.getTransportation();
  const otherExpenses = ConstructionTrackerService.getOtherExpenses();
  const metrics = ConstructionTrackerService.getAggregatedMetrics();

  const refresh = useCallback(() => {
    setDataVersion((v) => v + 1);
  }, []);

  return {
    dataVersion,
    refresh,
    project,
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
  };
}
