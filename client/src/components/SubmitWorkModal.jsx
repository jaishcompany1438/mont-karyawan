import React, { useState } from 'react';
import { api } from '../services/api';
import { X, Upload, CheckCircle } from 'lucide-react';

export default function SubmitWorkModal({ isOpen, onClose, onSuccess, task }) {
  const [keterangan, setKeterangan] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [anggaranTerpakai, setAnggaranTerpakai] = useState('0');

  if (!isOpen || !task) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file && !keterangan.trim()) {
      setError('Wajib mengunggah berkas bukti kerja atau menyertakan keterangan hasil pekerjaan.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      if (file) formData.append('bukti_kerja', file);
      if (keterangan) formData.append('keterangan', keterangan.trim());
      formData.append('anggaran_terpakai', anggaranTerpakai);

      await api.submitReview(task.id, formData);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Gagal mengirimkan bukti kerja.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
              {error}
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
              <p className="mt-1 text-[10px] text-slate-500">Isi 0 jika tidak ada realisasi biaya.</p>
            </div>
          </div>

          {/* Bukti File */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Unggah File Bukti Kerja (Laporan, PDF, Gambar, Screenshot, dsb)
            </label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 border border-slate-200 rounded-xl"
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
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
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
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold shadow-md shadow-emerald-700/20 disabled:opacity-50 flex items-center space-x-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{loading ? 'Mengirim...' : 'Submit for Review'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
