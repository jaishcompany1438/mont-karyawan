import React, { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login gagal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 grid place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-700 text-xl font-extrabold text-white">
          <img
            src="/logo.svg"
            alt="Logo PTQ Imam Ath Thobari"
            className="h-full w-full object-contain"
          />
        </div>
        <h1 className="text-center text-xl font-extrabold text-slate-900">Monitoring Karyawan</h1>
        <p className="mt-1 text-center text-xs text-slate-500">PTQ Imam Ath Thobari</p>
        {error && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
        <label className="mt-6 block text-xs font-bold text-slate-700">Email</label>
        <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="mt-4 block text-xs font-bold text-slate-700">Password</label>
        <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
          <LogIn className="h-4 w-4" /> {loading ? 'Memproses...' : 'Masuk'}
        </button>
        <p className="mt-5 flex items-center justify-center gap-1 text-[11px] text-slate-400"><ShieldCheck className="h-3.5 w-3.5" /> Akses dilindungi RBAC</p>
      </form>
    </main>
  );
}
