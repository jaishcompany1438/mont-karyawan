import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function Users({ refreshKey }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api.getUsers().then((r) => setUsers(r.data || [])).catch((e) => setError(e.message)); }, [refreshKey]);
  return <div className="space-y-5"><h2 className="text-2xl font-extrabold text-slate-900">Data Pengguna</h2>{error && <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}<div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-xs"><thead className="bg-slate-50 font-bold"><tr><th className="p-3">Nama</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Bidang</th></tr></thead><tbody className="divide-y">{users.map((user) => <tr key={user.id}><td className="p-3 font-semibold">{user.nama}</td><td className="p-3">{user.email}</td><td className="p-3">{user.role}</td><td className="p-3">{user.nama_bidang || '-'}</td></tr>)}</tbody></table></div></div>;
}
