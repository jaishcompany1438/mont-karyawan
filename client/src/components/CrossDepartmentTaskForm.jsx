import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Send, Upload, AlertCircle, Building2, Calendar, FileText, CheckCircle2 } from 'lucide-react';

export default function CrossDepartmentTaskForm({ departments = [], onSubmitSuccess, onCancel }) {
  const [deptList, setDeptList] = useState(departments);
  const [targetBidangId, setTargetBidangId] = useState('');
  const [judul, setJudul] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [file, setFile] = useState(null);
  const [urgensi, setUrgensi] = useState('SEDANG');
  const [dueDate, setDueDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (departments.length === 0) {
      api.getBidang()
        .then((res) => {
          if (res.success && Array.isArray(res.data)) {
            setDeptList(res.data);
          }
        })
        .catch((err) => console.error('Gagal memuat daftar bidang:', err));
    } else {
      setDeptList(departments);
    }
  }, [departments]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!targetBidangId || !judul.trim() || !deskripsi.trim() || !dueDate) {
      setError('Bidang tujuan, judul tugas, deskripsi, dan batas waktu wajib diisi.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccessMsg('');

      const formData = new FormData();
      formData.append('target_bidang_id', targetBidangId);
      formData.append('judul', judul.trim());
      formData.append('deskripsi', deskripsi.trim());
      formData.append('urgensi', urgensi);
      formData.append('due_date', dueDate);
      if (file) {
        formData.append('file_attachment', file);
      }

      const res = await api.createCrossRequest(formData);

      setSuccessMsg('Pengajuan tugas lintas bidang berhasil dikirimkan!');
      setJudul('');
      setDeskripsi('');
      setTargetBidangId('');
      setFile(null);
      setDueDate('');
      setUrgensi('SEDANG');

      if (onSubmitSuccess) {
        onSubmitSuccess(res);
      }
    } catch (err) {
      setError(err.message || 'Terjadi kendala saat mengirim pengajuan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 border-b border-slate-100 pb-3">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
          <Building2 className="h-5 w-5 text-emerald-600" />
          Form Pengajuan Tugas Lintas Bidang
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Ajukan permohonan bantuan pengerjaan tugas atau koordinasi ke divisi/bidang lain.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Bidang Tujuan */}
        <div>
          <label className="mb-1 block font-semibold text-slate-700">
            Bidang Tujuan *
          </label>
          <select
            value={targetBidangId}
            onChange={(e) => setTargetBidangId(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">-- Pilih Bidang Tujuan --</option>
            {deptList.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.nama_bidang} ({dept.kode_bidang})
              </option>
            ))}
          </select>
        </div>

        {/* Judul Tugas */}
        <div>
          <label className="mb-1 block font-semibold text-slate-700">
            Judul Tugas *
          </label>
          <input
            type="text"
            placeholder="Contoh: Pengadaan Sound System & LCD Ujian Tahfizh"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Deskripsi Lengkap */}
        <div>
          <label className="mb-1 block font-semibold text-slate-700">
            Deskripsi Lengkap *
          </label>
          <textarea
            rows="3"
            placeholder="Jelaskan kebutuhan tugas, rincian teknis, dan lokasi yang diperlukan..."
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Tingkat Urgensi & Batas Waktu */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              Tingkat Urgensi *
            </label>
            <select
              value={urgensi}
              onChange={(e) => setUrgensi(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="RENDAH">Rendah (Bisa dijadwalkan)</option>
              <option value="SEDANG">Sedang (Standar operasional)</option>
              <option value="TINGGI">Tinggi (Penting & segera)</option>
              <option value="URGEN">Urgen (Mendesak / Hari Ini)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              Batas Waktu (Due Date) *
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Upload Berkas */}
        <div>
          <label className="mb-1 block font-semibold text-slate-700">
            Unggah Berkas / Dokumen Pendukung (Opsional)
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0] || null)}
            className="w-full text-xs text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
          />
          {file && (
            <p className="mt-1 text-[11px] font-medium text-emerald-700">
              Berkas terpilih: {file.name}
            </p>
          )}
        </div>

        {/* Tombol Aksi */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100"
            >
              Batal
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2 font-bold text-white shadow-md shadow-emerald-700/20 hover:bg-emerald-600 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{loading ? 'Mengirim...' : 'Kirim Pengajuan'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

