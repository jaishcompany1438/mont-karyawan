import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { X, Upload, Calendar, User, Flag, Clock } from 'lucide-react';

export default function TaskModal({ isOpen, onClose, onSuccess, initialTask = null }) {
  const [judul, setJudul] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [periode, setPeriode] = useState('HARIAN');
  const [kategori, setKategori] = useState('RUTIN');
  const [prioritas, setPrioritas] = useState('SEDANG');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(true);
  const [anggaranDana, setAnggaranDana] = useState('0');
  const [attachment, setAttachment] = useState(null);

  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAssignees();
      if (initialTask) {
        setJudul(initialTask.judul || '');
        setDeskripsi(initialTask.deskripsi || '');
        setPeriode(initialTask.periode || 'HARIAN');
        setKategori(initialTask.kategori || 'RUTIN');
        setPrioritas(initialTask.prioritas || 'SEDANG');
        setAssignedTo(initialTask.assigned_to || '');
        setIsRecurring(Boolean(initialTask.is_recurring));
        setAnggaranDana(String(initialTask.anggaran_dana ?? 0));
        if (initialTask.due_date) {
          const date = new Date(initialTask.due_date);
          setDueDate(date.toISOString().slice(0, 16));
        }
      } else {
        setJudul('');
        setDeskripsi('');
        setPeriode('HARIAN');
        setKategori('RUTIN');
        setPrioritas('SEDANG');
        setAssignedTo('');
        // default due date: tomorrow 17:00
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(17, 0, 0, 0);
        setDueDate(tomorrow.toISOString().slice(0, 16));
        setAttachment(null);
        setIsRecurring(true);
        setAnggaranDana('0');
      }
      setError('');
    }
  }, [isOpen, initialTask]);

  const loadAssignees = async () => {
    try {
      const res = await api.getAssignees();
      if (res.success) {
        setAssignees(res.data);
        if (!initialTask && res.data.length > 0 && !assignedTo) {
          setAssignedTo(res.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load assignees:', err);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!judul.trim() || !assignedTo || !dueDate || anggaranDana === '') {
      setError('Judul, penerima, tenggat waktu, dan anggaran dana wajib diisi.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      formData.append('judul', judul.trim());
      formData.append('deskripsi', deskripsi.trim());
      formData.append('periode', periode);
      formData.append('kategori', kategori);
      formData.append('prioritas', prioritas);
      formData.append('assigned_to', assignedTo);
      formData.append('due_date', dueDate);
      formData.append('is_recurring', isRecurring ? '1' : '0');
      formData.append('anggaran_dana', anggaranDana);

      if (attachment) {
        formData.append('attachment', attachment);
      }

      if (initialTask) {
        await api.updateTask(initialTask.id, formData);
      } else {
        await api.createTask(formData);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan tugas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {initialTask ? 'Edit Detail Tugas' : 'Buat Tugas Pekerjaan Baru'}
            </h3>
            <p className="text-xs text-slate-500">
              Tentukan periode, prioritas, dan staf penanggung jawab
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

          {/* Judul */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Judul Tugas *</label>
            <input
              type="text"
              required
              placeholder="Contoh: Pembuatan Modul Tahfizh Pekanan"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
            />
          </div>

          {/* Deskripsi */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Deskripsi & Petunjuk Pengerjaan</label>
            <textarea
              rows="3"
              placeholder="Jelaskan instruksi tugas secara spesifik..."
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
            />
          </div>

          {/* Periode, Kategori & Prioritas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Periode Tugas *</label>
              <select
                value={periode}
                onChange={(e) => setPeriode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-slate-800 bg-white font-medium"
              >
                <option value="HARIAN">HARIAN (Daily)</option>
                <option value="PEKANAN">PEKANAN (Weekly)</option>
                <option value="BULANAN">BULANAN (Monthly)</option>
                <option value="TAHUNAN">TAHUNAN (Annual)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Anggaran Dana *</label>
              <input required min="0" step="0.01" type="number" value={anggaranDana} onChange={(e) => setAnggaranDana(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-slate-800" />
              <p className="mt-1 text-[10px] text-slate-500">Isi 0 jika tidak ada pengeluaran tunai.</p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Kategori</label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-slate-800 bg-white font-medium"
              >
                <option value="RUTIN">RUTIN</option>
                <option value="PROYEK">PROYEK</option>
                <option value="MENDADAK">MENDADAK</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Prioritas</label>
              <select
                value={prioritas}
                onChange={(e) => setPrioritas(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-slate-800 bg-white font-medium"
              >
                <option value="RENDAH">RENDAH</option>
                <option value="SEDANG">SEDANG</option>
                <option value="TINGGI">TINGGI</option>
                <option value="URGEN">URGEN</option>
              </select>
            </div>
          </div>

          {/* Assignee & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Penerima Tugas (Assignee) *</label>
              <select
                required
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-slate-800 bg-white font-medium"
              >
                <option value="">-- Pilih Staf / Penerima --</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nama} ({u.role} - {u.nama_bidang || 'Lembaga'})
                  </option>
                ))}
              </select>
            </div>

            {['HARIAN', 'PEKANAN', 'BULANAN'].includes(periode) && (
              <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-700" />
                <span>
                  <span className="block font-bold text-emerald-900">Jadikan pekerjaan berulang</span>
                  <span className="mt-0.5 block text-[11px] text-emerald-800">Instance tugas berikutnya dibuat otomatis setiap {periode === 'HARIAN' ? 'hari' : periode === 'PEKANAN' ? 'pekan' : 'bulan'} setelah tenggat.</span>
                </span>
              </label>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">Tenggat Waktu (Due Date) *</label>
              <input
                type="datetime-local"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-slate-800"
              />
            </div>
          </div>

          {/* Attachment */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Lampiran Dokumen Pendukung (Opsional)</label>
            <input
              type="file"
              onChange={(e) => setAttachment(e.target.files[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
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
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold shadow-md shadow-emerald-700/20 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : initialTask ? 'Simpan Perubahan' : 'Terbitkan Tugas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
