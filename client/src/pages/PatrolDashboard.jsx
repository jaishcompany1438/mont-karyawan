import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Camera, ChevronRight, ClipboardCheck, MapPin, User, X } from 'lucide-react';
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

// MySQL DATE columns can arrive either as a JS Date object or as a "YYYY-MM-DD"
// string depending on the driver/query path, so normalize both cases safely
// instead of blindly appending "T00:00:00" (which breaks on Date objects).
function parsePatrolDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const isoDay = String(value).slice(0, 10);
  const date = new Date(`${isoDay}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPatrolDate(value) {
  const date = parsePatrolDate(value);
  return date ? date.toLocaleDateString('id-ID') : '-';
}

function Indicators({ patrol }) {
  return <div className="flex flex-wrap gap-2">{indicators.map(([key, label]) => <span key={key} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600"><i className={`h-2.5 w-2.5 rounded-full ${colorClass[patrol[key]] || 'bg-slate-300'}`} />{label}: {patrol[key]}</span>)}</div>;
}

export default function PatrolDashboard({ refreshKey, onRefresh }) {
  const { user } = useAuth();
  const [patrols, setPatrols] = useState([]);
  const [stats, setStats] = useState({ total: 0, total_temuan: 0 });
  const [findingsOnly, setFindingsOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);
  const [error, setError] = useState('');
  const canPatrol = user?.role === 'SUPER_ADMIN' || user?.can_patroli || ['MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS'].includes(user?.role);
  const canManageRooms = user?.role === 'SUPER_ADMIN';

  const load = async () => {
    try {
      const [list, dashboard] = await Promise.all([api.getPatrols(findingsOnly ? { findings: '1' } : {}), api.getPatrolDashboard()]);
      setPatrols(list.data || []);
      setStats(dashboard.stats || {});
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, [findingsOnly, refreshKey]);

  // Group all patrol records by area/room name so the list reads as one row per area.
  const groups = useMemo(() => {
    const map = new Map();
    patrols.forEach((patrol) => {
      const key = patrol.ruangan || '-';
      if (!map.has(key)) map.set(key, { ruangan: key, entries: [] });
      map.get(key).entries.push(patrol);
    });
    return Array.from(map.values()).map((group) => {
      const entries = [...group.entries].sort((a, b) => (parsePatrolDate(b.tanggal) || 0) - (parsePatrolDate(a.tanggal) || 0));
      const findings = entries.filter((entry) => entry.catatan_temuan && entry.catatan_temuan.trim()).length;
      return { ...group, entries, total: entries.length, findings, latest: entries[0] };
    }).sort((a, b) => (parsePatrolDate(b.latest?.tanggal) || 0) - (parsePatrolDate(a.latest?.tanggal) || 0));
  }, [patrols]);

  return <div className="space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Kontrol fasilitas</p><h2 className="mt-1 text-2xl font-extrabold text-slate-900">Patroli Rumah Tangga</h2><p className="mt-2 text-sm text-slate-500">Pantau kebersihan, kerapihan, sarana prasarana, dan ketertiban area.</p></div>
    {error && <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
    <button type="button" onClick={() => setFindingsOnly((value) => !value)} className={`flex w-full items-center justify-between rounded-2xl border p-5 text-left transition ${findingsOnly ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white hover:border-rose-200'}`}>
      <span className="flex items-center gap-3"><span className="rounded-xl bg-rose-100 p-3 text-rose-600"><AlertTriangle className="h-5 w-5" /></span><span><span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Statistik Review</span><span className="mt-1 block text-2xl font-extrabold text-slate-900">{stats.total_temuan || 0}</span><span className="text-xs text-slate-500">Total Temuan Kritis · klik untuk filter</span></span></span><ChevronRight className="h-5 w-5 text-slate-400" /></button>
    {canPatrol && <PatrolForm onSuccess={() => { onRefresh(); load(); }} canManageRooms={canManageRooms} />}
    <section>
      <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900"><ClipboardCheck className="h-4 w-4 text-emerald-600" />{findingsOnly ? 'Patroli dengan Temuan' : 'Daftar Patroli'}</h3><span className="text-xs text-slate-500">{groups.length} area · {patrols.length} hasil</span></div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Nama Area</th>
              <th className="px-4 py-3">Jumlah Patroli</th>
              <th className="px-4 py-3">Temuan</th>
              <th className="px-4 py-3">Update Terakhir</th>
              <th className="px-4 py-3">Petugas Terakhir</th>
              <th className="px-4 py-3 text-right">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groups.map((group) => (
              <tr key={group.ruangan} onClick={() => setActiveGroup(group)} className="cursor-pointer transition hover:bg-emerald-50/60">
                <td className="px-4 py-3 font-extrabold text-slate-900"><span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-emerald-600" />{group.ruangan}</span></td>
                <td className="px-4 py-3 text-slate-600">{group.total}</td>
                <td className="px-4 py-3">{group.findings > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700"><AlertTriangle className="h-3 w-3" />{group.findings} temuan</span> : <span className="text-slate-400">-</span>}</td>
                <td className="px-4 py-3 text-slate-500">{group.latest ? formatPatrolDate(group.latest.tanggal) : '-'}</td>
                <td className="px-4 py-3 text-slate-500">{group.latest?.petugas_nama || '-'}</td>
                <td className="px-4 py-3 text-right"><ChevronRight className="ml-auto h-4 w-4 text-slate-400" /></td>
              </tr>
            ))}
            {!groups.length && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">Belum ada data patroli.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>

    {activeGroup && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4" onClick={() => setActiveGroup(null)}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div><p className="text-xs font-bold uppercase text-emerald-700">Riwayat Area</p><h3 className="mt-1 text-2xl font-extrabold text-slate-900">{activeGroup.ruangan}</h3><p className="mt-1 text-xs text-slate-500">{activeGroup.total} catatan patroli · {activeGroup.findings} temuan</p></div>
          <button onClick={() => setActiveGroup(null)} className="text-slate-400 hover:text-slate-600"><X className="h-6 w-6" /></button>
        </div>
        <div className="mt-4 space-y-3">
          {activeGroup.entries.map((patrol) => (
            <article key={patrol.id} onClick={() => setSelected(patrol)} className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-1 text-[11px] font-bold text-slate-600"><CalendarDays className="h-3 w-3" />{formatPatrolDate(patrol.tanggal)}</p>
                {patrol.catatan_temuan && <AlertTriangle className="h-4 w-4 text-rose-500" />}
              </div>
              <div className="mt-3"><Indicators patrol={patrol} /></div>
              <p className="mt-3 flex items-center gap-1 text-[11px] text-slate-500"><User className="h-3 w-3" />{patrol.petugas_nama}</p>
            </article>
          ))}
        </div>
      </div>
    </div>}

    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4" onClick={() => setSelected(null)}><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase text-emerald-700">Detail Patroli</p><h3 className="mt-1 text-2xl font-extrabold text-slate-900">{selected.ruangan}</h3></div><button onClick={() => setSelected(null)} className="text-2xl text-slate-400">&times;</button></div><div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2"><span><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{formatPatrolDate(selected.tanggal)}</span><span><User className="mr-1 inline h-3.5 w-3.5" />{selected.petugas_nama}</span></div><div className="mt-5"><Indicators patrol={selected} /></div>{selected.foto_bukti && <a href={selected.foto_bukti} target="_blank" rel="noreferrer" className="mt-5 block overflow-hidden rounded-2xl border border-slate-200"><img src={selected.foto_bukti} alt={`Bukti ${selected.ruangan}`} className="max-h-72 w-full object-cover transition hover:scale-105" /><span className="flex items-center gap-2 p-3 text-xs font-bold text-emerald-700"><Camera className="h-4 w-4" />Buka foto bukti</span></a>}<div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Catatan Temuan</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{selected.catatan_temuan || 'Tidak ada temuan.'}</p></div></div></div>}
  </div>;
}
