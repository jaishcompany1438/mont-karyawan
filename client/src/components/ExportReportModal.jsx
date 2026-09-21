import React from 'react';
import { Download, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const OPTIONAL_COLUMNS = [
  ['progress', 'Progress'],
  ['total_anggaran', 'Total Anggaran'],
  ['sisa_saldo', 'Sisa Saldo'],
  ['catatan_tugas', 'Catatan Tugas'],
  ['kendala_solusi', 'Kendala dan Solusi'],
  ['catatan_reviewer', 'Catatan Reviewer'],
  ['penilaian', 'Penilaian (Rata-rata)'],
  ['pelaksana', 'Pelaksana']
];

export default function ExportReportModal({ isOpen, onClose, filters = {} }) {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [format, setFormat] = React.useState('xlsx');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [bidang, setBidang] = React.useState([]);
  const [bidangId, setBidangId] = React.useState(filters.bidang_id || '');
  const [selectedColumns, setSelectedColumns] = React.useState(['judul', 'periode']);
  const isKabid = user?.role === 'KABID';

  React.useEffect(() => {
    if (!isOpen) return;
    api.getBidang().then((result) => {
      setBidang(result.data || []);
      if (isKabid) setBidangId(String(user.bidang_id || ''));
    }).catch((err) => setError(err.message));
  }, [isOpen, isKabid, user?.bidang_id]);

  const toggleColumn = (key) => {
    setSelectedColumns((current) => current.includes(key)
      ? current.filter((column) => column !== key)
      : [...current, key]);
  };

  const download = async () => {
    if (startDate && endDate && startDate > endDate) {
      setError('Tanggal mulai tidak boleh lebih besar dari tanggal akhir.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const exportFilters = {
        ...filters,
        bidang_id: isKabid ? user.bidang_id : bidangId,
        start_date: startDate,
        end_date: endDate,
        selected_columns: selectedColumns.join(',')
      };
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex justify-between">
          <h3 className="font-bold">Unduh Laporan</h3>
          <button onClick={onClose} aria-label="Tutup"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Pilih bidang, format, rentang tanggal, dan kolom laporan.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-slate-700">
            Format
            <select value={format} onChange={(e) => setFormat(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-xs">
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="pdf">PDF (.pdf)</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Pilih Bidang
            <select value={isKabid ? String(user.bidang_id || '') : bidangId} onChange={(e) => setBidangId(e.target.value)} disabled={isKabid} className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-xs disabled:bg-slate-100">
              {!isKabid && <option value="">Semua bidang</option>}
              {bidang.map((item) => <option key={item.id} value={item.id}>{item.nama_bidang}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-slate-700">Dari tanggal<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-xs" /></label>
          <label className="text-xs font-semibold text-slate-700">Sampai tanggal<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-xs" /></label>
        </div>
        <fieldset className="mt-4 rounded-xl border border-slate-200 p-3">
          <legend className="px-1 text-xs font-bold text-slate-700">Kolom Laporan</legend>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-2 text-slate-500"><input type="checkbox" checked disabled className="accent-emerald-700" />Judul Tugas (wajib)</label>
            <label className="flex items-center gap-2 text-slate-500"><input type="checkbox" checked disabled className="accent-emerald-700" />Periode (wajib)</label>
            {OPTIONAL_COLUMNS.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-slate-700"><input type="checkbox" checked={selectedColumns.includes(key)} onChange={() => toggleColumn(key)} className="accent-emerald-700" />{label}</label>)}
          </div>
        </fieldset>
        {error && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
        <button disabled={loading} onClick={download} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
          <Download className="h-4 w-4" /> {loading ? 'Menyiapkan...' : `Download ${format === 'pdf' ? 'PDF' : 'Excel'}`}
        </button>
      </div>
    </div>
  );
}
