import React, { useState } from 'react';
import ExportReportModal from '../components/ExportReportModal';

export default function Reports() {
  const [open, setOpen] = useState(false);
  return <div className="space-y-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Dokumentasi kinerja</p><h2 className="mt-1 text-2xl font-extrabold text-slate-900">Laporan & Rekap</h2></div><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm text-slate-600">Unduh rekap tugas dan status pekerjaan dalam format Excel untuk kebutuhan pelaporan.</p><button onClick={() => setOpen(true)} className="mt-5 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white">Export Rekap Excel</button></div><ExportReportModal isOpen={open} onClose={() => setOpen(false)} /></div>;
}
