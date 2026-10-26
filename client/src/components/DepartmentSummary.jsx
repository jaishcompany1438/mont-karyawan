import React from 'react';
import { Activity } from 'lucide-react';

export default function DepartmentSummary({ items = [], activeBidangId = '', onSelect }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <Activity className="h-4 w-4 text-blue-600" /> Rekap per Bidang
      </h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`rounded-xl border p-4 text-left transition hover:border-blue-300 hover:bg-blue-50 ${
              String(activeBidangId) === String(item.id) ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-600' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-extrabold text-slate-800">{item.nama_bidang}</p>
              <span className="text-[10px] font-bold text-blue-700">Lihat tugas</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px]">
              <span className="rounded-lg bg-white p-2">
                <strong className="block text-lg text-slate-900">{item.total_tasks || 0}</strong>Total
              </span>
              <span className="rounded-lg bg-blue-100 p-2">
                <strong className="block text-lg text-blue-800">{item.completed_tasks || 0}</strong>Selesai
              </span>
              <span className="rounded-lg bg-blue-100 p-2">
                <strong className="block text-lg text-blue-800">{item.in_progress_tasks || 0}</strong>Dikerjakan
              </span>
              <span className="rounded-lg bg-rose-100 p-2">
                <strong className="block text-lg text-rose-800">{item.overdue_tasks || 0}</strong>Lewat waktu
              </span>
            </div>
          </button>
        ))}
        {!items.length && <p className="text-xs text-slate-400">Belum ada ringkasan bidang.</p>}
      </div>
    </section>
  );
}
