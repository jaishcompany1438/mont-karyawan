import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { X, Upload, Calendar, User, Flag, Clock, CheckCircle2 } from 'lucide-react';
import SuccessToast from './SuccessToast';

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
  const [holidayExclusions, setHolidayExclusions] = useState([]);
  const [holidayDate, setHolidayDate] = useState('');
  const holidayOptions = [
    ['SATURDAY', 'Sabtu'],
    ['SUNDAY', 'Minggu'],
    ['FRIDAY', 'Jumat'],
    ['THURSDAY', 'Kamis'],
    ['WEDNESDAY', 'Rabu'],
    ['TUESDAY', 'Selasa'],
    ['MONDAY', 'Senin'],
  ];

  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
        try {
          setHolidayExclusions(initialTask.libur_pengecualian ? JSON.parse(initialTask.libur_pengecualian) : []);
        } catch {
          setHolidayExclusions([]);
        }
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
        setHolidayExclusions([]);
        setHolidayDate('');
      }
      setError('');
      setSuccess('');
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
      formData.append('libur_pengecualian', JSON.stringify(holidayExclusions));

      if (attachment) {
        formData.append('attachment', attachment);
      }

      if (initialTask) {
        await api.updateTask(initialTask.id, formData);
      } else {
        await api.createTask(formData);
      }

      setSuccess(initialTask ? 'Perubahan tugas berhasil disimpan.' : 'Tugas baru berhasil dibuat.');
      onSuccess();
      window.setTimeout(onClose, 900);
    } catch (err) {
      setError(err.message || 'Gagal menyimpan tugas.');
    } finally {
      setLoading(false);
    }
  };
//---------------------------------------
  return (
    <>
    <SuccessToast message={success} onClose={() => setSuccess('')} />
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
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

        <form id="task-form" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4 text-xs">
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
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
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
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
          </div>

          {/* Periode, Kategori & Prioritas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Periode Tugas *</label>
              <select
                value={periode}
                onChange={(e) => setPeriode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white font-medium"
              >
                <option value="HARIAN">HARIAN (Daily)</option>
                <option value="PEKANAN">PEKANAN (Weekly)</option>
                <option value="BULANAN">BULANAN (Monthly)</option>
                <option value="TAHUNAN">TAHUNAN (Annual)</option>
                <option value="INSIDENTAL">INSIDENTAL (Sewaktu-waktu)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Anggaran Dana *</label>
              <input required min="0" step="0.01" type="number" value={anggaranDana} onChange={(e) => setAnggaranDana(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 text-slate-800" />
              <p className="mt-1 text-[10px] text-slate-500">Isi 0 jika tidak ada pengeluaran tunai.</p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Kategori</label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white font-medium"
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
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white font-medium"
              >
                <option value="RENDAH">RENDAH</option>
                <option value="SEDANG">SEDANG</option>
                <option value="TINGGI">TINGGI</option>
                <option value="URGEN">URGEN</option>
              </select>
            </div>
          </div>

          {['HARIAN', 'PEKANAN', 'BULANAN'].includes(periode) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <label className="block font-bold text-amber-900 mb-2">Pengecualian Hari Libur</label>
              <div className="flex flex-wrap gap-3">
                {holidayOptions.map(([value, label]) => (
                  <label key={value} className="inline-flex items-center gap-2 text-amber-900">
                    <input
                      type="checkbox"
                      checked={holidayExclusions.includes(value)}
                      onChange={(e) => setHolidayExclusions((current) => e.target.checked
                        ? [...current, value]
                        : current.filter((item) => item !== value))}
                      className="h-4 w-4 accent-amber-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} className="rounded-lg border px-2 py-1.5 text-xs" />
                <button type="button" onClick={() => {
                  if (holidayDate && !holidayExclusions.includes(holidayDate)) setHolidayExclusions((current) => [...current, holidayDate]);
                  setHolidayDate('');
                }} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white">Tambah tanggal</button>
              </div>
              {holidayExclusions.filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)).length > 0 && (
                <p className="mt-2 text-[10px] text-amber-800">Tanggal khusus: {holidayExclusions.filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)).join(', ')}</p>
              )}
              <p className="mt-1 text-[10px] text-amber-800">Instance berulang akan dilewati jika jatuh pada pilihan di atas.</p>
            </div>
          )}

          {/* Assignee & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Penerima Tugas (Assignee) *</label>
              <select
                required
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white font-medium"
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
              <label className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-700" />
                <span>
                  <span className="block font-bold text-blue-900">Jadikan pekerjaan berulang</span>
                  <span className="mt-0.5 block text-[11px] text-blue-800">Instance tugas berikutnya dibuat otomatis setiap {periode === 'HARIAN' ? 'hari' : periode === 'PEKANAN' ? 'pekan' : 'bulan'} setelah tenggat.</span>
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
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 text-slate-800"
              />
            </div>
          </div>

          {/* Attachment */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Lampiran Dokumen Pendukung (Opsional)</label>
            <input
              type="file"
              onChange={(e) => setAttachment(e.target.files[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          </div>

          <div className="flex shrink-0 items-center justify-end space-x-2 border-t border-slate-100 bg-white px-6 py-4">
            {success && (
              <span className="mr-auto flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                <CheckCircle2 className="h-4 w-4" />{success}
              </span>
            )}
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
              className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold shadow-md shadow-blue-700/20 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : initialTask ? 'Simpan Perubahan' : 'Terbitkan Tugas'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}
