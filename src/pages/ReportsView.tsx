import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Package,
  Users,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  ProjectSettings,
  PurchaseRecord,
  MaterialUsage,
  WorkProgressItem,
  Contractor,
  LabourPayment,
  TransportationRecord,
  OtherExpenseRecord,
  BudgetCostItem,
} from '../types';
import { formatNaira, formatDate } from '../utils/formatters';

interface ReportsViewProps {
  project: ProjectSettings;
  metrics: {
    totalSpent: number;
    budgetCap: number;
    remainingBuffer: number;
    contingencyPercent: number;
    spentPercent: number;
    totalOutstanding: number;
    materialSpent: number;
    labourSpent: number;
    transportationSpent: number;
    otherSpent: number;
    stockInStoreValue: number;
    budgetCategories: BudgetCostItem[];
  };
  purchases: PurchaseRecord[];
  usage: MaterialUsage[];
  workProgress: WorkProgressItem[];
  contractors: Contractor[];
  labourPayments: LabourPayment[];
  transportation: TransportationRecord[];
  expenses: OtherExpenseRecord[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  project,
  metrics,
  purchases,
  usage,
  workProgress,
  contractors,
  labourPayments,
  transportation,
  expenses,
}) => {
  const [reportType, setReportType] = useState<
    'executive' | 'materials' | 'labour' | 'master'
  >('executive');

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';

    if (reportType === 'materials') {
      csvContent += 'Purchase Date,Material Name,Category,Supplier,Quantity,Unit,Unit Price,Acquisition Cost,Amount Paid,Supplier Balance,Waybill\r\n';
      purchases.forEach((p) => {
        csvContent += `"${p.purchaseDate}","${p.materialName}","${p.category}","${p.supplier}",${p.quantity},"${p.unit}",${p.unitPrice},${p.acquisitionCost},${p.amountPaid},${p.supplierBalance},"${p.waybillRef || ''}"\r\n`;
      });
    } else if (reportType === 'labour') {
      csvContent += 'Payment Date,Contractor Name,Trade,Milestone,Amount,Payment Method,Receipt Ref,Notes\r\n';
      labourPayments.forEach((l) => {
        csvContent += `"${l.paymentDate}","${l.contractorName}","${l.trade}","${l.milestoneTitle}",${l.amount},"${l.paymentMethod}","${l.receiptRef || ''}","${l.notes || ''}"\r\n`;
      });
    } else {
      // Master Ledger CSV
      csvContent += 'Type,Date,Description/Item,Category/Trade,Entity/Vendor,Amount (NGN),Status/Notes\r\n';
      purchases.forEach((p) => {
        csvContent += `"Material Purchase","${p.purchaseDate}","${p.materialName}","${p.category}","${p.supplier}",${p.acquisitionCost},"Bal: ${p.supplierBalance}"\r\n`;
      });
      labourPayments.forEach((l) => {
        csvContent += `"Labour Disbursement","${l.paymentDate}","${l.milestoneTitle}","${l.trade}","${l.contractorName}",${l.amount},"${l.paymentMethod}"\r\n`;
      });
      transportation.forEach((t) => {
        csvContent += `"Haulage","${t.date}","${t.itemTransported}","Haulage","${t.transporter}",${t.cost},"${t.from} -> ${t.to}"\r\n`;
      });
      expenses.forEach((e) => {
        csvContent += `"Site Expense","${e.date}","${e.description}","${e.category}","${e.paidBy}",${e.amount},"${e.receiptRef || ''}"\r\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `DHD_Report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Non-printable controls */}
      <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-[#E0E8FF] text-[#0F1E36] text-[11px] font-bold tracking-wider uppercase">
              Financial Audit & Statements
            </span>
            <span className="text-xs font-semibold text-[#059669]">
              Certified Ledger
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#081B38] tracking-tight mt-1">
            Site Reports & Export
          </h1>
          <p className="text-xs text-[#75777E] mt-0.5">
            Generate executive statements for property owners, sponsors and quantity surveyors
          </p>
        </div>

        {/* Export & Print CTAs */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="h-11 px-4 bg-[#F1F3FF] hover:bg-[#E8EDFF] text-[#081B38] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-[#E0E8FF]"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="h-11 px-4 bg-[#000412] hover:bg-[#0F1E36] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
          >
            <Printer size={15} />
            <span>Print Report (PDF)</span>
          </button>
        </div>
      </div>

      {/* Select Report Scope Pills */}
      <div className="flex items-center gap-2 border-b border-[#E8EDFF] pb-2 print:hidden">
        {[
          { id: 'executive', label: 'Executive Financial Summary' },
          { id: 'materials', label: 'Material Procurement & Valuation' },
          { id: 'labour', label: 'Subcontractor Liabilities & Payments' },
          { id: 'master', label: 'Master Audit Ledger (All Pillars)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              reportType === tab.id
                ? 'bg-[#000412] text-white shadow-xs'
                : 'text-[#44474D] hover:bg-[#E8EDFF] hover:text-[#081B38]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* REPORT PRINT CANVAS (Styled for both screen and @media print) */}
      <div className="bg-white rounded-2xl border border-[#E8EDFF] p-6 sm:p-8 shadow-xs print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="border-b border-[#081B38] pb-6 mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#000412] text-white flex items-center justify-center font-black text-sm">
                DHD
              </div>
              <span className="font-mono text-xs font-bold text-[#6B46C1] uppercase tracking-wider">
                Construction Project Tracker
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#081B38]">
              {project?.name || 'Finishing Project'}
            </h2>
            <p className="text-xs text-[#75777E] mt-0.5">
              Site Address: {project?.siteAddress || project?.location || 'Lagos, Nigeria'} • Project Code: {project?.code || '#LK2-884'}
            </p>
          </div>

          <div className="text-right text-xs">
            <span className="font-mono font-bold text-[#081B38] block">
              Generated: {formatDate(new Date().toISOString())}
            </span>
            <span className="text-[#75777E] block mt-0.5">
              Project Manager: {project?.projectManager || 'Site Engineer'}
            </span>
            <span className="px-2 py-0.5 rounded bg-[#DCFCE7] text-[#15803D] font-bold text-[10px] inline-block mt-1">
              Official Site Audit
            </span>
          </div>
        </div>

        {/* EXECUTIVE REPORT */}
        {reportType === 'executive' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#F9F9FF] rounded-xl border border-[#E8EDFF]">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#75777E] block">
                  Total Budget Cap
                </span>
                <span className="font-mono font-black text-base text-[#081B38]">
                  {formatNaira(metrics.budgetCap)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#75777E] block">
                  Total Actual Spent
                </span>
                <span className="font-mono font-black text-base text-[#081B38]">
                  {formatNaira(metrics.totalSpent)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#75777E] block">
                  Contingency Buffer
                </span>
                <span className="font-mono font-black text-base text-[#15803D]">
                  {formatNaira(metrics.remainingBuffer)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#75777E] block">
                  Outstanding Liabilities
                </span>
                <span className="font-mono font-black text-base text-[#BA1A1A]">
                  {formatNaira(metrics.totalOutstanding)}
                </span>
              </div>
            </div>

            {/* Pillar Breakdown Table */}
            <div>
              <h3 className="text-sm font-bold text-[#081B38] mb-2 uppercase tracking-wider text-[11px]">
                Fiscal Ledger Expenditure Breakdown
              </h3>
              <table className="w-full text-left text-xs border border-[#E8EDFF]">
                <thead>
                  <tr className="bg-[#F1F3FF] text-[#081B38] font-bold">
                    <th className="p-2.5 border border-[#E8EDFF]">Pillar</th>
                    <th className="p-2.5 border border-[#E8EDFF]">Allocated</th>
                    <th className="p-2.5 border border-[#E8EDFF]">Actual Spent</th>
                    <th className="p-2.5 border border-[#E8EDFF]">Variance</th>
                    <th className="p-2.5 border border-[#E8EDFF] text-right">Commitment %</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.budgetCategories.map((c) => (
                    <tr key={c.id}>
                      <td className="p-2.5 border border-[#E8EDFF] font-bold">{c.category}</td>
                      <td className="p-2.5 border border-[#E8EDFF] font-mono">
                        {formatNaira(c.allocatedBudget)}
                      </td>
                      <td className="p-2.5 border border-[#E8EDFF] font-mono font-bold">
                        {formatNaira(c.actualSpent)}
                      </td>
                      <td className="p-2.5 border border-[#E8EDFF] font-mono text-[#15803D]">
                        +{formatNaira(c.variance)}
                      </td>
                      <td className="p-2.5 border border-[#E8EDFF] font-mono text-right">
                        {c.allocatedBudget > 0
                          ? `${Math.round((c.actualSpent / c.allocatedBudget) * 100)}%`
                          : '0%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Finishing Milestones Snapshot */}
            <div>
              <h3 className="text-sm font-bold text-[#081B38] mb-2 uppercase tracking-wider text-[11px]">
                Finishing Trades Execution Status
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {workProgress.map((w) => (
                  <div
                    key={w.id}
                    className="p-3 rounded-lg border border-[#E8EDFF] flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#081B38]">{w.name}</span>
                      <span className="text-[11px] text-[#75777E] block">{w.category}</span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-bold text-[#081B38]">{w.completionPercent}%</span>
                      <span className="text-[10px] text-[#75777E] block">{w.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MATERIALS REPORT */}
        {reportType === 'materials' && (
          <div className="space-y-4">
            <div className="p-3 bg-[#F1F3FF] rounded-lg text-xs flex justify-between font-mono">
              <span>Total Material Spent: {formatNaira(metrics.materialSpent)}</span>
              <span>Vault In-Store Valuation: {formatNaira(metrics.stockInStoreValue)}</span>
            </div>
            <table className="w-full text-left text-xs border border-[#E8EDFF]">
              <thead>
                <tr className="bg-[#F1F3FF] text-[#081B38] font-bold text-[11px]">
                  <th className="p-2 border border-[#E8EDFF]">Material</th>
                  <th className="p-2 border border-[#E8EDFF]">Category</th>
                  <th className="p-2 border border-[#E8EDFF]">Qty & Rate</th>
                  <th className="p-2 border border-[#E8EDFF]">Landed Cost</th>
                  <th className="p-2 border border-[#E8EDFF]">Paid</th>
                  <th className="p-2 border border-[#E8EDFF]">Supplier</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="p-2 border border-[#E8EDFF] font-semibold">{p.materialName}</td>
                    <td className="p-2 border border-[#E8EDFF]">{p.category}</td>
                    <td className="p-2 border border-[#E8EDFF] font-mono">
                      {p.quantity} {p.unit} @ {formatNaira(p.unitPrice)}
                    </td>
                    <td className="p-2 border border-[#E8EDFF] font-mono font-bold">
                      {formatNaira(p.acquisitionCost)}
                    </td>
                    <td className="p-2 border border-[#E8EDFF] font-mono text-[#059669]">
                      {formatNaira(p.amountPaid)}
                    </td>
                    <td className="p-2 border border-[#E8EDFF]">{p.supplier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* LABOUR REPORT */}
        {reportType === 'labour' && (
          <div className="space-y-4">
            <div className="p-3 bg-[#F1F3FF] rounded-lg text-xs flex justify-between font-mono">
              <span>Total Agreed Contracts: {formatNaira(contractors.reduce((s, c) => s + c.agreedAmount, 0))}</span>
              <span>Total Disbursed: {formatNaira(metrics.labourSpent)}</span>
              <span className="text-[#BA1A1A]">Outstanding: {formatNaira(contractors.reduce((s, c) => s + c.outstandingBalance, 0))}</span>
            </div>
            <table className="w-full text-left text-xs border border-[#E8EDFF]">
              <thead>
                <tr className="bg-[#F1F3FF] text-[#081B38] font-bold text-[11px]">
                  <th className="p-2 border border-[#E8EDFF]">Subcontractor</th>
                  <th className="p-2 border border-[#E8EDFF]">Trade</th>
                  <th className="p-2 border border-[#E8EDFF]">Agreed Sum</th>
                  <th className="p-2 border border-[#E8EDFF]">Total Disbursed</th>
                  <th className="p-2 border border-[#E8EDFF]">Outstanding Liability</th>
                </tr>
              </thead>
              <tbody>
                {contractors.map((c) => (
                  <tr key={c.id}>
                    <td className="p-2 border border-[#E8EDFF] font-semibold">{c.name}</td>
                    <td className="p-2 border border-[#E8EDFF]">{c.trade}</td>
                    <td className="p-2 border border-[#E8EDFF] font-mono">{formatNaira(c.agreedAmount)}</td>
                    <td className="p-2 border border-[#E8EDFF] font-mono text-[#059669] font-bold">
                      {formatNaira(c.totalPaid)}
                    </td>
                    <td className="p-2 border border-[#E8EDFF] font-mono text-[#BA1A1A] font-bold">
                      {formatNaira(c.outstandingBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* MASTER AUDIT REPORT */}
        {reportType === 'master' && (
          <div className="space-y-4">
            <p className="text-xs text-[#75777E]">
              Complete chronological audit of all payments, purchases, haulage and site expenses.
            </p>
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-[#081B38]">Artisan Disbursements</h4>
              <table className="w-full text-left text-xs border border-[#E8EDFF] mb-4">
                <thead>
                  <tr className="bg-[#F1F3FF] font-bold text-[10px]">
                    <th className="p-2 border border-[#E8EDFF]">Date</th>
                    <th className="p-2 border border-[#E8EDFF]">Contractor</th>
                    <th className="p-2 border border-[#E8EDFF]">Milestone</th>
                    <th className="p-2 border border-[#E8EDFF]">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {labourPayments.map((l) => (
                    <tr key={l.id}>
                      <td className="p-2 border border-[#E8EDFF] font-mono">{formatDate(l.paymentDate)}</td>
                      <td className="p-2 border border-[#E8EDFF] font-semibold">{l.contractorName}</td>
                      <td className="p-2 border border-[#E8EDFF]">{l.milestoneTitle}</td>
                      <td className="p-2 border border-[#E8EDFF] font-mono font-bold text-[#059669]">
                        {formatNaira(l.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h4 className="text-xs font-bold uppercase text-[#081B38]">Logistics & Other Expenses</h4>
              <table className="w-full text-left text-xs border border-[#E8EDFF]">
                <thead>
                  <tr className="bg-[#F1F3FF] font-bold text-[10px]">
                    <th className="p-2 border border-[#E8EDFF]">Date</th>
                    <th className="p-2 border border-[#E8EDFF]">Type</th>
                    <th className="p-2 border border-[#E8EDFF]">Description</th>
                    <th className="p-2 border border-[#E8EDFF]">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {transportation.map((t) => (
                    <tr key={t.id}>
                      <td className="p-2 border border-[#E8EDFF] font-mono">{formatDate(t.date)}</td>
                      <td className="p-2 border border-[#E8EDFF]">Haulage</td>
                      <td className="p-2 border border-[#E8EDFF]">{t.itemTransported} ({t.from} → {t.to})</td>
                      <td className="p-2 border border-[#E8EDFF] font-mono font-bold">{formatNaira(t.cost)}</td>
                    </tr>
                  ))}
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="p-2 border border-[#E8EDFF] font-mono">{formatDate(e.date)}</td>
                      <td className="p-2 border border-[#E8EDFF]">{e.category}</td>
                      <td className="p-2 border border-[#E8EDFF]">{e.description}</td>
                      <td className="p-2 border border-[#E8EDFF] font-mono font-bold">{formatNaira(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Document Footer */}
        <div className="mt-8 pt-6 border-t border-[#E8EDFF] flex items-center justify-between text-[11px] text-[#75777E]">
          <div>
            Certified correct by Project Manager & Site Architect.
          </div>
          <div className="font-mono">
            Page 1 of 1 • DHD Construction Management Platform
          </div>
        </div>
      </div>
    </div>
  );
};
