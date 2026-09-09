import React from 'react';
import { Download, X } from 'lucide-react';
import { api } from '../services/api';

export default function ExportReportModal({ isOpen, onClose, filters = {} }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  if (!isOpen) return null;

  const download = async () => {
    setLoading(true);
    setError('');
    try {
      const blob = await api.downloadExportExcel(filters);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `rekap_kinerja_${Date.now()}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      setError(err.message || 'Gagal mengunduh laporan.');
    } finally {
      setLoading(false);
    }
  };

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4"><div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><h3 className="font-bold">Export Laporan</h3><button onClick={onClose}><X className="h-5 w-5" /></button></div><p className="mt-2 text-xs text-slate-500">Unduh rekap tugas sesuai filter yang dipilih.</p>{error && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}<button disabled={loading} onClick={download} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Download className="h-4 w-4" /> {loading ? 'Menyiapkan...' : 'Download Excel'}</button></div></div>;
}
