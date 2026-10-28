import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { X, Upload, CheckCircle } from 'lucide-react';
import SuccessToast from './SuccessToast';
import ExecutorPicker from './ExecutorPicker';

export default function SubmitWorkModal({ isOpen, onClose, onSuccess, task }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [pelaksanaIds, setPelaksanaIds] = useState([]);
  const [pelaksanaOptions, setPelaksanaOptions] = useState([]);
  const [loadingPelaksana, setLoadingPelaksana] = useState(false);
  const [keterangan, setKeterangan] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [anggaranTerpakai, setAnggaranTerpakai] = useState('0');
  const [kendala, setKendala] = useState('');
  const [solusi, setSolusi] = useState('');

  useEffect(() => {
    if (isOpen) {
      setKeterangan('');
      setFile(null);
      setAnggaranTerpakai('0');
      setKendala('');
      setSolusi('');
      setError('');
      setSuccess('');
      setPelaksanaIds(task?.assigned_to ? [String(task.assigned_to)] : []);
    }
  }, [isOpen, task?.id]);

  useEffect(() => {
    if (!isOpen || !isSuperAdmin) return undefined;
    let cancelled = false;
    setLoadingPelaksana(true);
    api.getUsers()
      .then((response) => { if (!cancelled) setPelaksanaOptions(response.data || []); })
      .catch(() => { if (!cancelled) setError('Gagal memuat daftar pelaksana tugas.'); })
      .finally(() => { if (!cancelled) setLoadingPelaksana(false); });
    return () => { cancelled = true; };
  }, [isOpen, isSuperAdmin]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file && !keterangan.trim()) {
      setError('Wajib mengunggah berkas bukti kerja atau menyertakan keterangan hasil pekerjaan.');
      return;
    }
    const spent = Number(anggaranTerpakai);
    if (!anggaranTerpakai.trim() || !Number.isFinite(spent) || spent < 0) {
      setError('Anggaran terpakai harus berupa angka nol atau lebih.');
      return;
    }
    if (isSuperAdmin && !pelaksanaIds.length) {
      setError('Pilih setidaknya satu pelaksana tugas.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      if (file) formData.append('bukti_kerja', file);
      if (keterangan) formData.append('keterangan', keterangan.trim());
      formData.append('kendala', kendala.trim());
      formData.append('solusi', solusi.trim());
      formData.append('anggaran_terpakai', anggaranTerpakai);
      if (isSuperAdmin) {
        pelaksanaIds.forEach((pelaksanaId) => formData.append('pelaksana_ids', pelaksanaId));
      }

      await api.submitReview(task.id, formData);
      setSuccess('Bukti kerja berhasil dikirim untuk direview.');
      onSuccess();
      window.setTimeout(onClose, 900);
    } catch (err) {
      setError(err.message || 'Gagal mengirimkan bukti kerja.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <SuccessToast message={success} onClose={() => setSuccess('')} />
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex shrink-0 items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Kirim Hasil & Bukti Kerja
            </h3>
            <p className="text-xs text-slate-500">
              Ajukan tugas untuk diverifikasi oleh pimpinan / kepala bidang
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
              {error}
            </div>
          )}

          {task.status === 'REVISION' && (task.catatan_revisi || task.catatan_reviewer) && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-2xl text-orange-900">
              <span className="block text-[10px] font-bold uppercase">Catatan Revisi dari Reviewer</span>
              <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed">{task.catatan_revisi || task.catatan_reviewer}</p>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Tugas Yang Dikerjakan</span>
            <h4 className="text-xs font-bold text-slate-900 mt-0.5">{task.judul}</h4>
            <div className="text-[11px] text-slate-500 mt-1">
              Periode: <span className="font-semibold text-slate-700">{task.periode}</span> • Tenggat:{' '}
              {new Date(task.due_date).toLocaleDateString('id-ID')}
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Anggaran Terpakai *</label>
              <input required min="0" step="0.01" type="number" value={anggaranTerpakai} onChange={(e) => setAnggaranTerpakai(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <p className="mt-1 text-[10px] text-slate-500">
                Anggaran awal Rp {Number(task.anggaran_dana || 0).toLocaleString('id-ID')}. Isi 0 jika tidak ada biaya; pengeluaran boleh melebihi pagu dan sisa saldo laporan akan tampil minus.
              </p>
            </div>
          </div>

          {isSuperAdmin && (
            <ExecutorPicker
              options={pelaksanaOptions}
              selectedIds={pelaksanaIds}
              loading={loadingPelaksana}
              helpText="Pilih satu atau beberapa pelaksana. Penerima tugas dipilih secara default."
              onChange={(id, checked) => setPelaksanaIds((current) => checked
                ? [...new Set([...current, id])]
                : current.filter((selectedId) => selectedId !== id))}
            />
          )}

          {/* Bukti File */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Unggah File Bukti Kerja (Laporan, PDF, Gambar, Screenshot, dsb)
            </label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Kendala (Opsional)</label>
            <textarea
              rows="2"
              value={kendala}
              onChange={(e) => setKendala(e.target.value)}
              placeholder="Tuliskan kendala yang ditemukan selama pelaksanaan tugas..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Solusi (Opsional)</label>
            <textarea
              rows="2"
              value={solusi}
              onChange={(e) => setSolusi(e.target.value)}
              placeholder="Tuliskan solusi atau tindak lanjut yang dilakukan..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Keterangan */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Keterangan / Catatan Pengerjaan
            </label>
            <textarea
              rows="3"
              placeholder="Contoh: Pekerjaan telah diselesaikan sesuai instruksi, berkas terlampir di atas..."
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
          </div>

          </div>
          <div className="flex shrink-0 items-center justify-end space-x-2 border-t border-slate-100 bg-white px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold shadow-md shadow-blue-700/20 disabled:opacity-50 flex items-center space-x-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{loading ? 'Mengirim...' : 'Submit for Review'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}
