import React, { useState } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  FileText,
  Calendar,
  Edit2,
  Trash2,
  TrendingDown,
  ArrowRight,
  Truck,
  DollarSign,
  User,
  CheckCircle2,
  LockKeyhole,
} from 'lucide-react';
import { Material, PurchaseRecord, MaterialUsage, MaterialCategory } from '../types';
import { formatNaira, formatDate, formatNumber } from '../utils/formatters';

interface MaterialsViewProps {
  materials: Material[];
  purchases: PurchaseRecord[];
  usage: MaterialUsage[];
  stockValue: number;
  lowStockCount: number;
  onOpenPurchaseModal: (initialData?: PurchaseRecord) => void;
  onOpenMaterialModal: () => void;
  onOpenUsageModal: (defaultMaterialId?: string, initialData?: MaterialUsage) => void;
  onDeletePurchase: (id: string, name: string) => void;
  onDeleteUsage: (id: string, name: string) => void;
  onDeleteMaterial: (id: string, name: string) => void;
}

const CATEGORY_CHIPS: (MaterialCategory | 'All')[] = [
  'All',
  'Tiles',
  'POP',
  'Paint',
  'Plumbing',
  'Sand',
  'Aluminium',
  'Electrical',
];

export const MaterialsView: React.FC<MaterialsViewProps> = ({
  materials,
  purchases,
  usage,
  stockValue,
  lowStockCount,
  onOpenPurchaseModal,
  onOpenMaterialModal,
  onOpenUsageModal,
  onDeletePurchase,
  onDeleteUsage,
  onDeleteMaterial,
}) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'purchases' | 'usage'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | 'All'>('All');

  // Filter materials
  const filteredMaterials = materials.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.supplier.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Filter purchases
  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      p.materialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.waybillRef && p.waybillRef.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Filter usages
  const filteredUsages = usage.filter((u) => {
    const matchesSearch =
      u.materialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.workArea.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.subcontractor && u.subcontractor.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner with Stitch Stats */}
      <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-[#E0E8FF] text-[#0F1E36] text-[11px] font-bold tracking-wider uppercase">
              Material Vault
            </span>
            {lowStockCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] text-[11px] font-bold flex items-center gap-1">
                <AlertTriangle size={12} />
                {lowStockCount} items low in stock
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#081B38] tracking-tight mt-1">
            Site Inventory & Procurement
          </h1>
          <p className="text-xs text-[#75777E] mt-0.5">
            Landed cost computation, physical stock custody and wastage control
          </p>
        </div>

        {/* Financial Stat Pill + Add Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-[#F1F3FF] px-4 py-2 rounded-xl border border-[#E0E8FF]">
            <span className="text-[10px] uppercase font-bold text-[#75777E] block">
              In-Store Stock Valuation
            </span>
            <span className="font-mono font-black text-lg text-[#081B38]">
              {formatNaira(stockValue)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenMaterialModal}
              className="h-11 px-4 bg-[#F1F3FF] hover:bg-[#E0E8FF] text-[#081B38] text-xs font-bold rounded-xl flex items-center gap-1.5 border border-[#E0E8FF] transition-colors cursor-pointer"
            >
              <Plus size={16} />
              <span>Register Material</span>
            </button>
            <button
              onClick={() => onOpenPurchaseModal()}
              className="h-11 px-4 bg-[#0F1E36] hover:bg-[#1A2B49] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={16} />
              <span>Record Purchase</span>
            </button>
            <button
              onClick={() => onOpenUsageModal()}
              className="h-11 px-4 bg-[#6B46C1] hover:bg-[#553C9A] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={16} />
              <span>Log Dispensation</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-[#E8EDFF] pb-2">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'inventory'
              ? 'bg-[#000412] text-white shadow-xs'
              : 'text-[#44474D] hover:bg-[#E8EDFF] hover:text-[#081B38]'
          }`}
        >
          Inventory & Stock ({materials.length})
        </button>
        <button
          onClick={() => setActiveTab('purchases')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'purchases'
              ? 'bg-[#000412] text-white shadow-xs'
              : 'text-[#44474D] hover:bg-[#E8EDFF] hover:text-[#081B38]'
          }`}
        >
          Purchase History ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab('usage')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'usage'
              ? 'bg-[#000412] text-white shadow-xs'
              : 'text-[#44474D] hover:bg-[#E8EDFF] hover:text-[#081B38]'
          }`}
        >
          Usage & Dispatch Log ({usage.length})
        </button>
      </div>

      {/* Search & Category Filter Chips */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#75777E]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search material name, supplier, lot # or work area..."
            className="w-full h-11 pl-10 pr-4 text-xs bg-white border border-[#E8EDFF] rounded-xl outline-none focus:border-[#6B46C1] text-[#081B38]"
          />
        </div>

        {/* Category Filter Chips */}
        {activeTab !== 'usage' && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {CATEGORY_CHIPS.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#0F1E36] text-white'
                    : 'bg-white border border-[#E8EDFF] text-[#44474D] hover:bg-[#F1F3FF]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* TAB 1: INVENTORY & STOCK CARDS */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {filteredMaterials.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-[#E8EDFF] space-y-3">
              <Package size={36} className="mx-auto text-[#75777E]" />
              <h3 className="font-bold text-[#081B38] text-base">No materials found</h3>
              <p className="text-xs text-[#75777E] max-w-sm mx-auto">
                No inventory records match your criteria. Record a material purchase or clear search filters.
              </p>
              <button
                onClick={() => onOpenPurchaseModal()}
                className="px-4 py-2 bg-[#0F1E36] text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                + Add Purchase
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMaterials.map((mat) => {
                const hasPurchaseHistory = purchases.some((p) => p.materialId === mat.id);
                const lowStockThreshold = Number(mat.lowStockThreshold || 0);
                const isLow = lowStockThreshold > 0 && mat.remaining > 0 && mat.remaining <= lowStockThreshold;
                const isDepleted = mat.totalPurchased > 0 && mat.remaining === 0;
                const usagePercent =
                  mat.totalPurchased > 0
                    ? Math.round((mat.totalUsed / mat.totalPurchased) * 100)
                    : 0;

                return (
                  <div
                    key={mat.id}
                    className="bg-white rounded-2xl border border-[#E8EDFF] p-5 shadow-xs hover:border-[#6B46C1] transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top bar with category & status */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded-full bg-[#E0E8FF] text-[#0F1E36] text-[10px] font-bold uppercase tracking-wider">
                          {mat.category}
                        </span>
                        {isDepleted ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#FFDAD6] text-[#BA1A1A] text-[10px] font-bold">
                            Depleted (0 {mat.unit})
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] text-[10px] font-bold flex items-center gap-1">
                            <AlertTriangle size={11} /> Low ({mat.remaining} {mat.unit})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] font-bold">
                            In Stock ({mat.remaining} {mat.unit})
                          </span>
                        )}
                      </div>

                      {/* Title & lot */}
                      <h3 className="text-base font-bold text-[#081B38] leading-snug">{mat.name}</h3>
                      <p className="text-xs text-[#75777E] mt-0.5 truncate">
                        {mat.supplier} {mat.lotNumber && `• ${mat.lotNumber}`}
                      </p>

                      {/* Stock breakdown numbers */}
                      <div className="grid grid-cols-3 gap-2 mt-4 p-3 bg-[#F9F9FF] rounded-xl border border-[#E8EDFF] text-center">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#75777E] block">
                            Purchased
                          </span>
                          <span className="font-mono font-bold text-xs text-[#081B38]">
                            {mat.totalPurchased} {mat.unit}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#75777E] block">
                            Dispatched
                          </span>
                          <span className="font-mono font-bold text-xs text-[#6B46C1]">
                            {mat.totalUsed} {mat.unit}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#75777E] block">
                            Remaining
                          </span>
                          <span
                            className={`font-mono font-bold text-xs ${
                              isDepleted ? 'text-[#BA1A1A]' : 'text-[#059669]'
                            }`}
                          >
                            {mat.remaining} {mat.unit}
                          </span>
                        </div>
                      </div>

                      {/* Consumption progress bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[11px] text-[#75777E] mb-1">
                          <span>Usage: {usagePercent}%</span>
                          <span>In Vault: {100 - usagePercent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#E8EDFF] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#6B46C1] rounded-full transition-all"
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Financial info */}
                      <div className="mt-3 pt-3 border-t border-[#F1F3FF] flex items-center justify-between text-xs">
                        <span className="text-[#75777E]">Avg Rate:</span>
                        <span className="font-mono font-bold text-[#081B38]">
                          {formatNaira(mat.avgUnitPrice)} / {mat.unit}
                        </span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-4 pt-3 border-t border-[#E8EDFF] flex items-center justify-between gap-2">
                      <button
                        onClick={() => onOpenUsageModal(mat.id)}
                        disabled={mat.remaining <= 0}
                        className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                          mat.remaining > 0
                            ? 'bg-[#6B46C1] hover:bg-[#553C9A] text-white cursor-pointer'
                            : 'bg-[#E8EDFF] text-[#75777E] cursor-not-allowed'
                        }`}
                      >
                        <Plus size={14} />
                        <span>Log Usage</span>
                      </button>

                      {hasPurchaseHistory ? (
                        <div
                          title="Material has purchase history. Administrator action required."
                          className="w-8 h-8 rounded-lg text-[#6B46C1] bg-[#F1F3FF] flex items-center justify-center"
                        >
                          <LockKeyhole size={15} />
                        </div>
                      ) : (
                        <button
                          onClick={() => onDeleteMaterial(mat.id, mat.name)}
                          title="Delete unused material"
                          className="w-8 h-8 rounded-lg text-[#75777E] hover:text-[#BA1A1A] hover:bg-[#FFDAD6] flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PURCHASE HISTORY (Section 8) */}
      {activeTab === 'purchases' && (
        <div className="bg-white rounded-2xl border border-[#E8EDFF] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E8EDFF] flex items-center justify-between bg-[#F9F9FF]">
            <div>
              <h3 className="text-sm font-bold text-[#081B38]">Purchase Consignments Ledger</h3>
              <p className="text-xs text-[#75777E]">Landed cost breakdown (Base + Haulage + Offload) & balances</p>
            </div>
            <button
              onClick={() => onOpenPurchaseModal()}
              className="h-9 px-3 bg-[#0F1E36] hover:bg-[#1A2B49] text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Plus size={15} />
              <span>New Purchase</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E8EDFF] bg-[#F1F3FF] text-[#75777E] font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Material & Lot</th>
                  <th className="p-3.5">Quantity & Rate</th>
                  <th className="p-3.5">Logistics (Haulage/Offload)</th>
                  <th className="p-3.5">Landed Cost</th>
                  <th className="p-3.5">Paid vs Balance</th>
                  <th className="p-3.5">Supplier & Date</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EDFF]">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#75777E]">
                      No purchases logged yet.
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((pur) => (
                    <tr key={pur.id} className="hover:bg-[#F9F9FF] transition-colors">
                      <td className="p-3.5 font-semibold text-[#081B38]">
                        <div className="font-bold">{pur.materialName}</div>
                        <div className="text-[11px] text-[#75777E] flex items-center gap-1 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded bg-[#E0E8FF] text-[#0F1E36] font-mono text-[10px]">
                            {pur.category}
                          </span>
                          {pur.waybillRef && <span>• {pur.waybillRef}</span>}
                        </div>
                      </td>
                      <td className="p-3.5 font-mono">
                        <div>
                          {pur.quantity} {pur.unit}
                        </div>
                        <div className="text-[11px] text-[#75777E]">@ {formatNaira(pur.unitPrice)}</div>
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-[#75777E]">
                        <div>Haulage: {formatNaira(pur.haulageCost)}</div>
                        <div>Offload: {formatNaira(pur.offloadingCost)}</div>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-[#081B38]">
                        {formatNaira(pur.acquisitionCost)}
                      </td>
                      <td className="p-3.5">
                        <div className="font-mono text-[#059669]">Paid: {formatNaira(pur.amountPaid)}</div>
                        {pur.supplierBalance > 0 ? (
                          <div className="font-mono font-bold text-[#BA1A1A] text-[11px]">
                            Bal: {formatNaira(pur.supplierBalance)}
                          </div>
                        ) : (
                          <div className="text-[10px] text-[#059669] font-semibold">Settled</div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="font-medium text-[#081B38]">{pur.supplier}</div>
                        <div className="text-[11px] text-[#75777E]">{formatDate(pur.purchaseDate)}</div>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onOpenPurchaseModal(pur)}
                            title="Edit Purchase"
                            className="p-1.5 rounded-lg text-[#75777E] hover:text-[#081B38] hover:bg-[#E8EDFF] cursor-pointer"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => onDeletePurchase(pur.id, pur.materialName)}
                            title="Delete Purchase"
                            className="p-1.5 rounded-lg text-[#75777E] hover:text-[#BA1A1A] hover:bg-[#FFDAD6] cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: USAGE & DISPATCH LOG (Section 9) */}
      {activeTab === 'usage' && (
        <div className="bg-white rounded-2xl border border-[#E8EDFF] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E8EDFF] flex items-center justify-between bg-[#F9F9FF]">
            <div>
              <h3 className="text-sm font-bold text-[#081B38]">Site Stock Usage & Allocation Ledger</h3>
              <p className="text-xs text-[#75777E]">Subcontractor custody, rooms installed & snag check</p>
            </div>
            <button
              onClick={() => onOpenUsageModal()}
              className="h-9 px-3 bg-[#6B46C1] hover:bg-[#553C9A] text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Plus size={15} />
              <span>Record Usage</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E8EDFF] bg-[#F1F3FF] text-[#75777E] font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Material & Dispensed Quantity</th>
                  <th className="p-3.5">Work Area / Room</th>
                  <th className="p-3.5">Custody / Subcontractor</th>
                  <th className="p-3.5">Notes</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EDFF]">
                {filteredUsages.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#75777E]">
                      No usage records registered yet.
                    </td>
                  </tr>
                ) : (
                  filteredUsages.map((u) => (
                    <tr key={u.id} className="hover:bg-[#F9F9FF] transition-colors">
                      <td className="p-3.5 font-mono text-[#75777E] whitespace-nowrap">
                        {formatDate(u.date)}
                      </td>
                      <td className="p-3.5 font-semibold text-[#081B38]">
                        <div>{u.materialName}</div>
                        <span className="font-mono text-xs text-[#6B46C1] font-bold">
                          {u.quantityUsed} {u.unit}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="font-medium text-[#081B38] bg-[#F1F3FF] px-2 py-1 rounded-md">
                          {u.workArea}
                        </span>
                      </td>
                      <td className="p-3.5 text-[#44474D] font-medium">
                        {u.subcontractor || 'General Site Team'}
                      </td>
                      <td className="p-3.5 text-xs text-[#75777E] max-w-xs truncate">
                        {u.notes || '—'}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onOpenUsageModal(undefined, u)}
                            title="Edit Usage"
                            className="p-1.5 rounded-lg text-[#75777E] hover:text-[#081B38] hover:bg-[#E8EDFF] cursor-pointer"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => onDeleteUsage(u.id, u.materialName)}
                            title="Delete Usage"
                            className="p-1.5 rounded-lg text-[#75777E] hover:text-[#BA1A1A] hover:bg-[#FFDAD6] cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
