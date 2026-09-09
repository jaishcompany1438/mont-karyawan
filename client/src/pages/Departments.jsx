import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function Departments({ refreshKey, onRefresh }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ nama_bidang: '', kode_bidang: '', deskripsi: '' });
  const [error, setError] = useState('');
  useEffect(() => { api.getBidang().then((r) => setItems(r.data || [])).catch((e) => setError(e.message)); }, [refreshKey]);
  const submit = async (e) => { e.preventDefault(); try { await api.createBidang(form); setForm({ nama_bidang: '', kode_bidang: '', deskripsi: '' }); onRefresh(); } catch (err) { setError(err.message); } };
  return <div className="space-y-5"><h2 className="text-2xl font-extrabold text-slate-900">Struktur Bidang</h2>{error && <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}<form onSubmit={submit} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4"><input required placeholder="Nama bidang" value={form.nama_bidang} onChange={(e) => setForm({ ...form, nama_bidang: e.target.value })} className="rounded-xl border px-3 py-2 text-sm" /><input required placeholder="Kode" value={form.kode_bidang} onChange={(e) => setForm({ ...form, kode_bidang: e.target.value })} className="rounded-xl border px-3 py-2 text-sm" /><input placeholder="Deskripsi" value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} className="rounded-xl border px-3 py-2 text-sm" /><button className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Tambah Bidang</button></form><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm font-bold">{item.nama_bidang}</p><p className="text-xs text-emerald-700">{item.kode_bidang}</p><p className="mt-2 text-xs text-slate-500">{item.total_karyawan || 0} karyawan · {item.active_tasks || 0} tugas aktif</p></div>)}</div></div>;
}
