import React from 'react';
import {
  Truck,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Calendar,
  FileText,
  DollarSign,
} from 'lucide-react';
import { TransportationRecord } from '../types';
import { formatNaira, formatDate } from '../utils/formatters';

interface TransportViewProps {
  transportation: TransportationRecord[];
  onOpenTransportModal: (initialData?: TransportationRecord) => void;
  onDeleteTransport: (id: string, item: string) => void;
}

export const TransportView: React.FC<TransportViewProps> = ({
  transportation,
  onOpenTransportModal,
  onDeleteTransport,
}) => {
  const totalCost = transportation.reduce((sum, t) => sum + t.cost, 0);
  const totalTrips = transportation.length;
  const avgTripCost = totalTrips > 0 ? Math.round(totalCost / totalTrips) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E8EDFF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-[#E0E8FF] text-[#0F1E36] text-[11px] font-bold tracking-wider uppercase">
              Logistics & Freight
            </span>
            <span className="text-xs font-semibold text-[#75777E]">{totalTrips} Trips Recorded</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#081B38] tracking-tight mt-1">
            Transportation & Haulage
          </h1>
          <p className="text-xs text-[#75777E] mt-0.5">
            Tipper loads, quarry deliveries, waybills and material freight tracking
          </p>
        </div>

        <button
          onClick={() => onOpenTransportModal()}
          className="h-11 px-4 bg-[#0F1E36] hover:bg-[#1A2B49] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <Plus size={16} />
          <span>+ Log Haulage Trip</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#E8EDFF] shadow-xs">
          <span className="text-[11px] font-bold text-[#75777E] uppercase tracking-wider block">
            Total Freight Spend
          </span>
          <span className="font-mono text-xl sm:text-2xl font-black text-[#081B38] mt-1 block">
            {formatNaira(totalCost)}
          </span>
          <span className="text-xs text-[#75777E] mt-1 block">Cumulative logistics expenditure</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E8EDFF] shadow-xs">
          <span className="text-[11px] font-bold text-[#75777E] uppercase tracking-wider block">
            Consignments Hauled
          </span>
          <span className="font-mono text-xl sm:text-2xl font-black text-[#6B46C1] mt-1 block">
            {totalTrips} Loads
          </span>
          <span className="text-xs text-[#75777E] mt-1 block">Site drop-offs completed</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E8EDFF] shadow-xs">
          <span className="text-[11px] font-bold text-[#75777E] uppercase tracking-wider block">
            Average Trip Cost
          </span>
          <span className="font-mono text-xl sm:text-2xl font-black text-[#059669] mt-1 block">
            {formatNaira(avgTripCost)}
          </span>
          <span className="text-xs text-[#75777E] mt-1 block">Per haulage delivery</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E8EDFF] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E8EDFF] flex items-center justify-between bg-[#F9F9FF]">
          <div>
            <h3 className="text-sm font-bold text-[#081B38]">Haulage Records</h3>
            <p className="text-xs text-[#75777E]">Waybills, origins, transporters and freight invoices</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E8EDFF] bg-[#F1F3FF] text-[#75777E] font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Material & Quantity</th>
                <th className="p-3.5">Route (Origin → Destination)</th>
                <th className="p-3.5">Transporter & Waybill</th>
                <th className="p-3.5">Haulage Cost</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EDFF]">
              {transportation.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#75777E]">
                    No haulage records logged yet.
                  </td>
                </tr>
              ) : (
                transportation.map((t) => (
                  <tr key={t.id} className="hover:bg-[#F9F9FF] transition-colors">
                    <td className="p-3.5 font-mono text-[#75777E] whitespace-nowrap">
                      {formatDate(t.date)}
                    </td>
                    <td className="p-3.5 font-semibold text-[#081B38]">
                      <div>{t.itemTransported}</div>
                      <div className="text-[11px] text-[#75777E]">{t.quantityDescription}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1 text-[#081B38] font-medium">
                        <MapPin size={13} className="text-[#6B46C1] shrink-0" />
                        <span>{t.from}</span>
                        <span className="text-[#75777E]">→</span>
                        <span>{t.to}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-medium text-[#081B38]">{t.transporter}</div>
                      {t.waybillRef && (
                        <div className="text-[11px] text-[#75777E] font-mono">
                          Waybill: {t.waybillRef}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-xs text-[#081B38]">
                      {formatNaira(t.cost)}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onOpenTransportModal(t)}
                          className="p-1.5 rounded-lg text-[#75777E] hover:text-[#081B38] hover:bg-[#E8EDFF] cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => onDeleteTransport(t.id, t.itemTransported)}
                          className="p-1.5 rounded-lg text-[#75777E] hover:text-[#BA1A1A] hover:bg-[#FFDAD6] cursor-pointer"
                          title="Delete"
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
    </div>
  );
};
