import React, { useEffect, useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const initialForm = {
  nama: '',
  email: '',
  password: '',
  role: 'STAF',
  bidang_id: '',
  jabatan: ''
};

export default function Users({ refreshKey, onRefresh }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [bidang, setBidang] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getUsers(), api.getBidang()])
      .then(([usersResponse, bidangResponse]) => {
        if (cancelled) return;
        setUsers(usersResponse.data || []);
        setBidang(bidangResponse.data || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.createUser({
        ...form,
        bidang_id: form.bidang_id || null
      });
      setForm(initialForm);
      setShowForm(false);
      setSuccess('Pengguna berhasil ditambahkan.');
      onRefresh();
    } catch (err) {
      setError(err.message || 'Gagal menambahkan pengguna.');
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Akses dan akun</p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-900">Data Pengguna</h2>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => {
              setShowForm((value) => !value);
              setError('');
              setSuccess('');
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-600"
          >
            <Plus className="h-4 w-4" /> Tambah Pengguna
          </button>
        )}
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">{success}</div>}

      {showForm && isSuperAdmin && (
        <form onSubmit={submit} className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-emerald-700" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tambah Pengguna Baru</h3>
              <p className="text-[11px] text-slate-500">Akun dapat digunakan setelah berhasil disimpan.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-700">
              Nama Lengkap *
              <input required value={form.nama} onChange={(e) => updateField('nama', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="text-xs font-bold text-slate-700">
              Email *
              <input required type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="text-xs font-bold text-slate-700">
              Password Awal *
              <input required minLength="6" type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="text-xs font-bold text-slate-700">
              Role *
              <select required value={form.role} onChange={(e) => updateField('role', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="STAF">STAF</option>
                <option value="KABID">KABID</option>
                <option value="WAKIL_MUDIR">WAKIL_MUDIR</option>
                <option value="MUDIR">MUDIR</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-700">
              Bidang
              <select value={form.bidang_id} onChange={(e) => updateField('bidang_id', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Tidak ditentukan</option>
                {bidang.map((item) => <option key={item.id} value={item.id}>{item.nama_bidang} ({item.kode_bidang})</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-700">
              Jabatan
              <input value={form.jabatan} onChange={(e) => updateField('jabatan', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Batal</button>
            <button disabled={loading} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{loading ? 'Menyimpan...' : 'Simpan Pengguna'}</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 font-bold text-slate-600">
            <tr><th className="p-3">Nama</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Bidang</th><th className="p-3">Jabatan</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((item) => <tr key={item.id}><td className="p-3 font-semibold text-slate-800">{item.nama}</td><td className="p-3">{item.email}</td><td className="p-3">{item.role}</td><td className="p-3">{item.nama_bidang || '-'}</td><td className="p-3">{item.jabatan || '-'}</td></tr>)}
            {!users.length && <tr><td colSpan="5" className="p-8 text-center text-slate-400">Belum ada data pengguna.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
