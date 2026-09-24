import React, { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import SuccessToast from './SuccessToast';

const PARAMETERS = [
  ['kebersihan', 'Kebersihan'],
  ['kerapihan', 'Kerapihan'],
  ['sarpras', 'Sarpras'],
  ['ketertiban', 'Ketertiban']
];

function getColor(score) {
  if (score <= 1.5) return 'MERAH';
  if (score <= 3.9) return 'ORANYE';
  return 'HIJAU';
}

const colorStyles = {
  MERAH: { text: 'text-rose-700', track: 'accent-rose-600', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
  ORANYE: { text: 'text-orange-700', track: 'accent-orange-500', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
  HIJAU: { text: 'text-blue-700', track: 'accent-blue-600', badge: 'bg-blue-100 text-blue-700 border-blue-200' }
};

export default function PatrolForm({ onSuccess, canManageRooms = false }) {
  const [rooms, setRooms] = useState([]);
  const [room, setRoom] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scores, setScores] = useState({ kebersihan: 3, kerapihan: 3, sarpras: 3, ketertiban: 3 });
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [newRoom, setNewRoom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const hasCritical = useMemo(() => Object.values(scores).some((score) => getColor(score) === 'MERAH'), [scores]);

  const loadRooms = async () => {
    const response = await api.getPatrolRooms();
    setRooms(response.data || []);
    if (!room && response.data?.length) setRoom(String(response.data[0].id));
  };

  useEffect(() => {
    loadRooms().catch((err) => setError(err.message));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (!room || !date) return setError('Area dan tanggal wajib diisi.');
    if (hasCritical && !note.trim()) return setError('Catatan temuan wajib diisi untuk penilaian MERAH.');
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('ruangan', rooms.find((item) => String(item.id) === String(room))?.nama_ruangan || '');
      formData.append('tanggal', date);
      PARAMETERS.forEach(([key]) => {
        formData.append(`skor_${key}`, scores[key]);
        formData.append(`nilai_${key}`, getColor(scores[key]));
      });
      formData.append('catatan_temuan', note.trim());
      if (photo) formData.append('foto_bukti', photo);
      await api.createPatrol(formData);
      setSuccess('Patroli berhasil disimpan.');
      setNote('');
      setPhoto(null);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan patroli.');
    } finally {
      setLoading(false);
    }
  };

  const addRoom = async (event) => {
    event.preventDefault();
    if (!newRoom.trim()) return;
    try {
      await api.createPatrolRoom(newRoom.trim());
      setNewRoom('');
      await loadRooms();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
    <SuccessToast message={success} onClose={() => setSuccess('')} />
    <form onSubmit={submit} className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Input inspeksi</p><h3 className="mt-1 text-lg font-extrabold text-slate-900">Catat Patroli Fasilitas</h3></div>
        <Camera className="h-6 w-6 text-blue-600" />
      </div>
      {error && <div className="mb-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
      {success && <div className="mb-4 flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-700"><CheckCircle2 className="h-4 w-4" />{success}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-700">Area / Ruangan *
          <select required value={room} onChange={(e) => setRoom(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Pilih area</option>{rooms.map((item) => <option value={item.id} key={item.id}>{item.nama_ruangan}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-700">Tanggal *
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
      </div>
      {canManageRooms && <div className="mt-3 flex gap-2"><input value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="Tambah area baru..." className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-xs" /><button type="button" onClick={addRoom} className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white">Tambah Area</button></div>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {PARAMETERS.map(([key, label]) => {
          const color = getColor(scores[key]);
          const style = colorStyles[color];
          return <label key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold text-slate-700">
            <div className="flex items-center justify-between"><span>{label}</span><span className={`rounded-full border px-2 py-1 text-[10px] ${style.badge}`}>{color}</span></div>
            <input type="range" min="0" max="5" step="0.1" value={scores[key]} onChange={(e) => setScores((current) => ({ ...current, [key]: Number(e.target.value) }))} className={`mt-4 w-full ${style.track}`} />
            <div className={`mt-1 flex justify-between ${style.text}`}><span>0</span><span className="font-extrabold">{scores[key].toFixed(1)} / 5</span><span>5</span></div>
          </label>;
        })}
      </div>
      <label className="mt-5 block text-xs font-bold text-slate-700">Catatan Temuan {hasCritical && <span className="text-rose-600">*</span>}
        <textarea rows="3" required={hasCritical} value={note} onChange={(e) => setNote(e.target.value)} placeholder={hasCritical ? 'Wajib jelaskan temuan kritis...' : 'Tambahkan catatan bila diperlukan...'} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-blue-500" />
      </label>
      <label className="mt-4 block text-xs font-bold text-slate-700">Foto Bukti (opsional)
        <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs font-normal" />
      </label>
      <button disabled={loading} className="mt-5 w-full rounded-xl bg-blue-700 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-600 disabled:opacity-50">{loading ? 'Menyimpan...' : 'Simpan Hasil Patroli'}</button>
    </form>
    </>
  );
}
