import React, { useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, Camera, ChevronRight, ClipboardCheck, User } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PatrolForm from '../components/PatrolForm';

const indicators = [
  ['nilai_kebersihan', 'Kebersihan'],
  ['nilai_kerapihan', 'Kerapihan'],
  ['nilai_sarpras', 'Sarpras'],
  ['nilai_ketertiban', 'Ketertiban']
];
const colorClass = { MERAH: 'bg-rose-500', ORANYE: 'bg-orange-400', HIJAU: 'bg-emerald-500' };

function Indicators({ patrol }) {
  return <div className="flex flex-wrap gap-2">{indicators.map(([key, label]) => <span key={key} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600"><i className={`h-2.5 w-2.5 rounded-full ${colorClass[patrol[key]] || 'bg-slate-300'}`} />{label}: {patrol[key]}</span>)}</div>;
}

export default function PatrolDashboard({ refreshKey, onRefresh }) {
  const { user } = useAuth();
  const [patrols, setPatrols] = useState([]);
  const [stats, setStats] = useState({ total: 0, total_temuan: 0 });
  const [findingsOnly, setFindingsOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const canPatrol = user?.role === 'SUPER_ADMIN' || user?.can_patroli || ['MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS', 'KABID'].includes(user?.role);
  const canManageRooms = user?.role === 'SUPER_ADMIN';

  const load = async () => {
    try {
      const [list, dashboard] = await Promise.all([api.getPatrols(findingsOnly ? { findings: '1' } : {}), api.getPatrolDashboard()]);
      setPatrols(list.data || []);
      setStats(dashboard.stats || {});
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, [findingsOnly, refreshKey]);

  return <div className="space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Kontrol fasilitas</p><h2 className="mt-1 text-2xl font-extrabold text-slate-900">Patroli Rumah Tangga</h2><p className="mt-2 text-sm text-slate-500">Pantau kebersihan, kerapihan, sarana prasarana, dan ketertiban area.</p></div>
    {error && <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
    <button type="button" onClick={() => setFindingsOnly((value) => !value)} className={`flex w-full items-center justify-between rounded-2xl border p-5 text-left transition ${findingsOnly ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white hover:border-rose-200'}`}>
      <span className="flex items-center gap-3"><span className="rounded-xl bg-rose-100 p-3 text-rose-600"><AlertTriangle className="h-5 w-5" /></span><span><span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Statistik Review</span><span className="mt-1 block text-2xl font-extrabold text-slate-900">{stats.total_temuan || 0}</span><span className="text-xs text-slate-500">Total Temuan Kritis · klik untuk filter</span></span></span><ChevronRight className="h-5 w-5 text-slate-400" /></button>
    {canPatrol && <PatrolForm onSuccess={() => { onRefresh(); load(); }} canManageRooms={canManageRooms} />}
    <section><div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900"><ClipboardCheck className="h-4 w-4 text-emerald-600" />{findingsOnly ? 'Patroli dengan Temuan' : 'Daftar Patroli'}</h3><span className="text-xs text-slate-500">{patrols.length} hasil</span></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {patrols.map((patrol) => <article key={patrol.id} onClick={() => setSelected(patrol)} className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><h4 className="font-extrabold text-slate-900">{patrol.ruangan}</h4><p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><CalendarDays className="h-3 w-3" />{new Date(`${patrol.tanggal}T00:00:00`).toLocaleDateString('id-ID')}</p></div>{patrol.catatan_temuan && <AlertTriangle className="h-4 w-4 text-rose-500" />}</div><div className="mt-4"><Indicators patrol={patrol} /></div><p className="mt-4 flex items-center gap-1 text-[11px] text-slate-500"><User className="h-3 w-3" />{patrol.petugas_nama}</p></article>)}
      {!patrols.length && <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">Belum ada data patroli.</div>}
    </div></section>
    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4" onClick={() => setSelected(null)}><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase text-emerald-700">Detail Patroli</p><h3 className="mt-1 text-2xl font-extrabold text-slate-900">{selected.ruangan}</h3></div><button onClick={() => setSelected(null)} className="text-2xl text-slate-400">&times;</button></div><div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2"><span><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{new Date(`${selected.tanggal}T00:00:00`).toLocaleDateString('id-ID')}</span><span><User className="mr-1 inline h-3.5 w-3.5" />{selected.petugas_nama}</span></div><div className="mt-5"><Indicators patrol={selected} /></div>{selected.foto_bukti && <a href={selected.foto_bukti} target="_blank" rel="noreferrer" className="mt-5 block overflow-hidden rounded-2xl border border-slate-200"><img src={selected.foto_bukti} alt={`Bukti ${selected.ruangan}`} className="max-h-72 w-full object-cover transition hover:scale-105" /><span className="flex items-center gap-2 p-3 text-xs font-bold text-emerald-700"><Camera className="h-4 w-4" />Buka foto bukti</span></a>}<div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Catatan Temuan</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{selected.catatan_temuan || 'Tidak ada temuan.'}</p></div></div></div>}
  </div>;
}
