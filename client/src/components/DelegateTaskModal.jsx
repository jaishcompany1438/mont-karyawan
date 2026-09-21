import React, { useEffect, useState } from 'react';
import { CheckCircle, UserRound, X } from 'lucide-react';
import { api } from '../services/api';
import SuccessToast from './SuccessToast';

export default function DelegateTaskModal({ isOpen, task, staff = [], onClose, onSuccess }) {
  const [assignedTo, setAssignedTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAssignedTo('');
      setError('');
      setSuccess('');
    }
  }, [isOpen, task?.id]);

  if (!isOpen || !task) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!assignedTo) {
      setError('Pilih staf penerima delegasi.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await api.delegateTask(task.id, assignedTo);
      setSuccess('Tugas berhasil didelegasikan kepada staf.');
      onSuccess();
      window.setTimeout(onClose, 800);
    } catch (err) {
      setError(err.message || 'Gagal mendelegasikan tugas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SuccessToast message={success} onClose={() => setSuccess('')} />
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4">
        <form onSubmit={submit} className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Delegasikan Tugas</h3>
              <p className="mt-1 text-xs text-slate-500">{task.judul}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Tutup"><X className="h-5 w-5 text-slate-400" /></button>
          </div>
          <div className="space-y-4 p-6 text-xs">
            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-medium text-rose-700">{error}</div>}
            <label className="block font-bold text-slate-700">
              Staf Pelaksana
              <span className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 font-normal">
                <UserRound className="h-4 w-4 text-slate-400" />
                <select required value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} className="w-full bg-transparent outline-none">
                  <option value="">Pilih staf bidang Anda</option>
                  {staff.filter((item) => item.role === 'STAF').map((item) => (
                    <option key={item.id} value={item.id}>{item.nama}{item.sub_bidang ? ` - ${item.sub_bidang}` : ''}</option>
                  ))}
                </select>
              </span>
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100">Batal</button>
            <button type="submit" disabled={loading} className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50">
              <CheckCircle className="h-4 w-4" />{loading ? 'Menyimpan...' : 'Delegasikan'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
