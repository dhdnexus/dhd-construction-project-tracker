import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  itemName?: string;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1E36]/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#FFDAD6] w-full max-w-sm p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-2xl bg-[#FFDAD6] text-[#BA1A1A] flex items-center justify-center mb-4 mx-auto">
          <AlertTriangle size={24} />
        </div>
        <h3 className="text-base font-bold text-[#081B38] text-center mb-1">{title}</h3>
        {itemName && (
          <p className="text-xs font-semibold text-[#BA1A1A] text-center bg-[#FFDAD6]/40 p-2 rounded-lg mb-2 truncate">
            {itemName}
          </p>
        )}
        <p className="text-xs text-[#75777E] text-center mb-6 leading-relaxed">{message}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={onClose}
            className="py-2.5 px-4 text-xs font-semibold text-[#44474D] bg-[#F1F3FF] hover:bg-[#E8EDFF] rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="py-2.5 px-4 text-xs font-bold text-white bg-[#BA1A1A] hover:bg-[#93000A] rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-colors cursor-pointer"
          >
            <Trash2 size={15} />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
