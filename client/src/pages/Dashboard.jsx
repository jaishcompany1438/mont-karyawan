import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PeriodTabs from '../components/PeriodTabs';
import StatCards from '../components/StatCards';
import { Activity, RefreshCw } from 'lucide-react';

export default function Dashboard({ refreshKey, onNavigate }) {
  const [period, setPeriod] = useState('');
  const [data, setData] = useState({ stats: {}, byPeriod: [], departmentSummary: [] });
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    api.getDashboardStats(period ? { periode: period } : {}).then((result) => {
      if (!cancelled) setData(result);
    }).catch((err) => {
      if (!cancelled) setError(err.message);
    });
    return () => { cancelled = true; };
  }, [period, refreshKey]);

  const counts = data.byPeriod.reduce((acc, item) => ({ ...acc, [item.periode]: item.total }), { total: data.stats.total || 0 });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Ringkasan kinerja</p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-900">Dashboard Utama</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Assalamualaikum {user?.nama}, semoga selalu semangat bekerja.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Segarkan
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

      <PeriodTabs selectedPeriod={period} onChange={setPeriod} counts={counts} />
      <StatCards stats={data.stats} activeFilter={period} onCardClick={() => onNavigate('tasks')} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Activity className="h-4 w-4 text-blue-600" /> Rekap per Bidang
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.departmentSummary.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onNavigate('tasks', { bidang_id: item.id })}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-extrabold text-slate-800">{item.nama_bidang}</p>
                <span className="text-[10px] font-bold text-blue-700">Lihat tugas</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px]">
                <span className="rounded-lg bg-white p-2">
                  <strong className="block text-lg text-slate-900">{item.total_tasks || 0}</strong>Total
                </span>
                <span className="rounded-lg bg-blue-100 p-2">
                  <strong className="block text-lg text-blue-800">{item.completed_tasks || 0}</strong>Selesai
                </span>
                <span className="rounded-lg bg-blue-100 p-2">
                  <strong className="block text-lg text-blue-800">{item.in_progress_tasks || 0}</strong>Dikerjakan
                </span>
                <span className="rounded-lg bg-rose-100 p-2">
                  <strong className="block text-lg text-rose-800">{item.overdue_tasks || 0}</strong>Lewat waktu
                </span>
              </div>
            </button>
          ))}
          {!data.departmentSummary.length && (
            <p className="text-xs text-slate-400">Belum ada ringkasan bidang.</p>
          )}
        </div>
      </section>
    </div>
  );
}
