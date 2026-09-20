import React from 'react';
import { CheckCircle2, X } from 'lucide-react';

export default function SuccessToast({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="fixed right-4 top-4 z-[70] flex max-w-sm items-start gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-800 shadow-xl shadow-emerald-900/10 animate-in fade-in slide-in-from-top-2">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      <span className="flex-1 font-semibold">{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="text-emerald-500 hover:text-emerald-800" aria-label="Tutup notifikasi">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
