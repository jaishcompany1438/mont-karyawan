import React from 'react';
import { Download, X } from 'lucide-react';
import { api } from '../services/api';

export default function ExportReportModal({ isOpen, onClose, filters = {}, user }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [format, setFormat] = React.useState('xlsx');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [departments, setDepartments] = React.useState([]);
  const [departmentId, setDepartmentId] = React.useState('');
  const isKabid = user?.role === 'KABID';

  React.useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    api.getBidang().then((res) => {
      if (cancelled) return;
      const data = Array.isArray(res.data) ? res.data : [];
      setDepartments(data);
      if (isKabid) setDepartmentId(String(user?.bidang_id || ''));
      else if (data.length === 1) setDepartmentId(String(data[0].id));
    }).catch((err) => {
      if (!cancelled) setError(err.message || 'Gagal memuat daftar bidang.');
    });
    return () => { cancelled = true; };
  }, [isOpen, isKabid, user?.bidang_id]);

  React.useEffect(() => {
    if (!isOpen) {
      setDepartments([]);
      setDepartmentId('');
      setError('');
    }
  }, [isOpen]);
  if (!isOpen) return null;

  const download = async () => {
    if (startDate && endDate && startDate > endDate) {
      setError('Tanggal mulai tidak boleh lebih besar dari tanggal akhir.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const exportFilters = { ...filters, start_date: startDate, end_date: endDate, bidang_id: departmentId };
      const isPdf = format === 'pdf';
      const blob = isPdf
        ? await api.downloadExportPdf(exportFilters)
        : await api.downloadExportExcel(exportFilters);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `rekap_kinerja_${Date.now()}.${isPdf ? 'pdf' : 'xlsx'}`;
      anchor.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      setError(err.message || 'Gagal mengunduh laporan.');
    } finally {
      setLoading(false);
    }
  };

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4"><div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><h3 className="font-bold">Unduh Laporan</h3><button onClick={onClose}><X className="h-5 w-5" /></button></div><p className="mt-2 text-xs text-slate-500">Pilih bidang, format, dan rentang tanggal laporan.</p><label className="mt-4 block text-xs font-semibold text-slate-700">Bidang<select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} disabled={isKabid} className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-xs disabled:bg-slate-100">{!isKabid && <option value="">Semua Bidang</option>}{departments.map((department) => <option key={department.id} value={department.id}>{department.nama_bidang} ({department.kode_bidang})</option>)}</select></label>{isKabid && <p className="mt-1 text-[10px] text-slate-500">Bidang laporan mengikuti bidang Anda.</p>}<div className="mt-4"><label className="text-xs font-semibold text-slate-700">Format<select value={format} onChange={(e) => setFormat(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-xs"><option value="xlsx">Excel (.xlsx)</option><option value="pdf">PDF (.pdf)</option></select></label></div><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-slate-700">Dari tanggal<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-xs" /></label><label className="text-xs font-semibold text-slate-700">Sampai tanggal<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-xs" /></label></div>{error && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}<button disabled={loading} onClick={download} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Download className="h-4 w-4" /> {loading ? 'Menyiapkan...' : `Download ${format === 'pdf' ? 'PDF' : 'Excel'}`}</button></div></div>;
}
