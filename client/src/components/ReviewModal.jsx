import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { X, CheckCircle, RotateCcw, Paperclip, FileText, User } from 'lucide-react';
import SuccessToast from './SuccessToast';

export default function ReviewModal({ isOpen, onClose, onSuccess, task }) {
  const [catatanRevisi, setCatatanRevisi] = useState('');
  const [catatanReviewer, setCatatanReviewer] = useState('');
  const [ratings, setRatings] = useState({ sop: '3', waktu: '3', kualitas: '3' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen && task) {
      setCatatanRevisi(task.catatan_revisi || '');
      setCatatanReviewer(task.catatan_reviewer || '');
      setRatings({
        sop: String(task.nilai_sop ?? '3'),
        waktu: String(task.nilai_waktu ?? '3'),
        kualitas: String(task.nilai_kualitas ?? '3')
      });
      setError('');
      setSuccess('');
    }
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const handleAction = async (action) => {
    if (action === 'REJECT' && !catatanRevisi.trim()) {
      setError('Catatan revisi wajib diisi jika hasil pekerjaan ditolak / diminta perbaikan.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      if (!ratings.sop || !ratings.waktu || !ratings.kualitas) {
        setError('Semua nilai reviewer wajib diisi.');
        return;
      }

      await api.reviewTask(task.id, {
        action,
        catatan_revisi: catatanRevisi.trim(),
        catatan_reviewer: catatanReviewer.trim(),
        nilai_sop: ratings.sop,
        nilai_waktu: ratings.waktu,
        nilai_kualitas: ratings.kualitas
      });

      setSuccess(action === 'APPROVE' ? 'Tugas berhasil disetujui.' : 'Tugas berhasil dikirim untuk revisi.');
      onSuccess();
      window.setTimeout(onClose, 900);
    } catch (err) {
      setError(err.message || 'Gagal memproses verifikasi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <SuccessToast message={success} onClose={() => setSuccess('')} />
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Verifikasi & Review Pekerjaan
            </h3>
            <p className="text-xs text-slate-500">
              Periksa bukti hasil kerja staf, lalu putuskan untuk menyetujui atau meminta revisi
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Task Info */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Judul Tugas</span>
              <h4 className="text-sm font-bold text-slate-900">{task.judul}</h4>
            </div>

            {task.deskripsi && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Instruksi Awal</span>
                <p className="text-slate-600 mt-0.5 leading-relaxed">{task.deskripsi}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-slate-500">
              <span>Penerima Tugas: <strong className="text-slate-800">{task.assignee_nama}</strong></span>
              <span>Bidang: <strong className="text-slate-800">{task.nama_bidang}</strong></span>
            </div>
          </div>

          {/* Work Proof Submitted */}
          <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl">
            <span className="text-[10px] font-bold text-emerald-800 uppercase flex items-center mb-1">
              <FileText className="w-3 h-3 mr-1" /> Bukti Kerja Yang Dikirimkan
            </span>
            {task.bukti_kerja ? (
              task.bukti_kerja.startsWith('/uploads/') ? (
                <div className="mt-2">
                  <a
                    href={task.bukti_kerja}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors shadow-xs"
                  >
                    <Paperclip className="w-3.5 h-3.5 mr-1.5" /> Buka / Unduh Berkas Bukti Kerja
                  </a>
                </div>
              ) : (
                <p className="p-2.5 bg-white border border-emerald-200 rounded-xl text-slate-800 mt-1 whitespace-pre-wrap">
                  {task.bukti_kerja}
                </p>
              )
            ) : (
              <p className="text-slate-500 italic mt-1">Tidak ada berkas bukti kerja terlampir.</p>
            )}
          </div>

          {/* Revision Notes Input */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              ['sop', 'Nilai SOP'],
              ['waktu', 'Nilai Waktu'],
              ['kualitas', 'Nilai Kualitas']
            ].map(([key, label]) => (
              <label key={key} className="font-bold text-slate-700">
                {label} (1-5)
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="0.1"
                  value={ratings[key]}
                  onChange={(e) => setRatings((current) => ({ ...current, [key]: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
            ))}
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Catatan Reviewer
            </label>
            <textarea
              rows="2"
              placeholder="Catatan penilaian untuk dokumentasi laporan..."
              value={catatanReviewer}
              onChange={(e) => setCatatanReviewer(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Catatan Revisi / Masukan (Wajib diisi jika menolak/minta perbaikan)
            </label>
            <textarea
              rows="3"
              placeholder="Jelaskan bagian mana yang perlu diperbaiki oleh staf..."
              value={catatanRevisi}
              onChange={(e) => setCatatanRevisi(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
            />
          </div>

          {/* Action Decision Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleAction('REJECT')}
              className="flex-1 py-2.5 px-4 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 rounded-xl font-bold transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4 text-orange-600" />
              <span>Minta Revisi (Reject)</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleAction('APPROVE')}
              className="flex-1 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors shadow-md shadow-emerald-700/20 flex items-center justify-center space-x-1.5 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Setujui Selesai (Approve)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
