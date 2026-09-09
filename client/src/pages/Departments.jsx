import React, { useEffect, useState } from 'react';
import { Edit2, Save, Trash2, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const emptyForm = { nama_bidang: '', kode_bidang: '', deskripsi: '' };

export default function Departments({ refreshKey, onRefresh }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const load = () => api.getBidang().then((response) => setItems(response.data || [])).catch((err) => setError(err.message));
  useEffect(() => { load(); }, [refreshKey]);

  const submit = async (event) => {
    event.preventDefault();
    try {
      if (editingId) await api.updateBidang(editingId, form);
      else await api.createBidang(form);
      setForm(emptyForm);
      setEditingId(null);
      onRefresh();
    } catch (err) { setError(err.message); }
  };

  const remove = async (id) => {
    if (!window.confirm('Hapus bidang ini?')) return;
    try { await api.deleteBidang(id); onRefresh(); } catch (err) { setError(err.message); }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-extrabold text-slate-900">Struktur Bidang</h2>
      {error && <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
      {isSuperAdmin && <form onSubmit={submit} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <input required placeholder="Nama bidang" value={form.nama_bidang} onChange={(e) => setForm({ ...form, nama_bidang: e.target.value })} className="rounded-xl border px-3 py-2 text-sm" />
        <input required placeholder="Kode" value={form.kode_bidang} onChange={(e) => setForm({ ...form, kode_bidang: e.target.value })} className="rounded-xl border px-3 py-2 text-sm" />
        <input placeholder="Deskripsi" value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} className="rounded-xl border px-3 py-2 text-sm" />
        <div className="flex gap-2"><button className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white">{editingId ? <Save className="h-3.5 w-3.5" /> : null}{editingId ? 'Simpan' : 'Tambah Bidang'}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="rounded-xl border px-3"><X className="h-4 w-4" /></button>}</div>
      </form>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex justify-between gap-2"><div><p className="text-sm font-bold">{item.nama_bidang}</p><p className="text-xs text-emerald-700">{item.kode_bidang}</p></div>{isSuperAdmin && <div className="flex gap-1"><button onClick={() => { setEditingId(item.id); setForm({ nama_bidang: item.nama_bidang, kode_bidang: item.kode_bidang, deskripsi: item.deskripsi || '' }); }} className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50"><Edit2 className="h-3.5 w-3.5" /></button><button onClick={() => remove(item.id)} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button></div>}</div><p className="mt-2 text-xs text-slate-500">{item.total_karyawan || 0} karyawan · {item.active_tasks || 0} tugas aktif</p></div>)}</div>
    </div>
  );
}
