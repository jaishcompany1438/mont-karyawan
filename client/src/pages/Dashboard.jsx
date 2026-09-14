import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PeriodTabs from '../components/PeriodTabs';
import StatCards from '../components/StatCards';
import CrossDepartmentTaskForm from '../components/CrossDepartmentTaskForm';
import { Activity, RefreshCw, ArrowRightLeft, Plus, CheckCircle, Clock, XCircle } from 'lucide-react';

export default function Dashboard({ refreshKey, onNavigate }) {
  const [period, setPeriod] = useState('');
  const [data, setData] = useState({ stats: {}, byPeriod: [], departmentSummary: [] });
  const [crossRequests, setCrossRequests] = useState([]);
  const [showCrossForm, setShowCrossForm] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  const loadData = () => {
    api.getDashboardStats(period ? { periode: period } : {})
      .then((result) => setData(result))
      .catch((err) => setError(err.message));

    api.getCrossRequests()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setCrossRequests(res.data);
        }
      })
      .catch((err) => console.error('Gagal mengambil data pengajuan lintas bidang:', err));
  };

  useEffect(() => {
    loadData();
  }, [period, refreshKey]);

  const getUrgencyBadge = (u) => {
    switch (u) {
      case 'URGEN': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'TINGGI': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'SEDANG': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadge = (s) => {
    switch (s) {
      case 'APPROVED': return { label: 'Disetujui', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'REJECTED': return { label: 'Ditolak', cls: 'bg-rose-100 text-rose-800 border-rose-200' };
      default: return { label: 'Menunggu', cls: 'bg-amber-100 text-amber-800 border-amber-200' };
    }
  };

  const counts = data.byPeriod.reduce((acc, item) => ({ ...acc, [item.periode]: item.total }), { total: data.stats.total || 0 });

  return (
    <div className="space-y-6">
      {/* Header Dashboard */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Ringkasan kinerja</p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-900">Dashboard Utama</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Assalamualaikum {user?.nama}, semoga selalu semangat bekerja.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCrossForm(!showCrossForm)}
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-700/20 hover:bg-emerald-600 transition"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span>{showCrossForm ? 'Tutup Form Pengajuan' : 'Pengajuan Lintas Bidang'}</span>
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Segarkan
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

      {/* Form Pengajuan Tugas Lintas Bidang (Kolapsibel / Toggle) */}
      {showCrossForm && (
        <div className="animate-in fade-in zoom-in-95 duration-150">
          <CrossDepartmentTaskForm
            onSubmitSuccess={() => {
              setShowCrossForm(false);
              loadData();
            }}
            onCancel={() => setShowCrossForm(false)}
          />
        </div>
      )}

      {/* Tab Filter Periode & Stat Cards */}
      <PeriodTabs selectedPeriod={period} onChange={setPeriod} counts={counts} />
      <StatCards stats={data.stats} activeFilter={period} onCardClick={() => onNavigate('tasks')} />

      {/* Daftar Pengajuan Tugas Lintas Bidang Terbaru */}
      {crossRequests.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <ArrowRightLeft className="h-4 w-4 text-emerald-600" />
              Aktivitas Koordinasi & Pengajuan Lintas Bidang
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              {crossRequests.length} pengajuan tercatat
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {crossRequests.slice(0, 6).map((req) => {
              const statusBadge = getStatusBadge(req.status);
              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/30"
                >
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getUrgencyBadge(req.urgensi)}`}>
                      {req.urgensi}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${statusBadge.cls}`}>
                      {statusBadge.label}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1 mb-1">
                    {req.judul}
                  </h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mb-2.5">
                    {req.deskripsi}
                  </p>

                  <div className="pt-2 border-t border-slate-200/80 text-[10px] text-slate-500 flex items-center justify-between">
                    <div>
                      Dari: <strong className="text-slate-700">{req.from_user_nama}</strong>
                    </div>
                    <div>
                      Ke: <strong className="text-emerald-800">{req.target_bidang_nama}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Rekap per Bidang */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Activity className="h-4 w-4 text-emerald-600" /> Rekap per Bidang
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.departmentSummary.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onNavigate('tasks', { bidang_id: item.id })}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-extrabold text-slate-800">{item.nama_bidang}</p>
                <span className="text-[10px] font-bold text-emerald-700">Lihat tugas</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px]">
                <span className="rounded-lg bg-white p-2">
                  <strong className="block text-lg text-slate-900">{item.total_tasks || 0}</strong>Total
                </span>
                <span className="rounded-lg bg-emerald-100 p-2">
                  <strong className="block text-lg text-emerald-800">{item.completed_tasks || 0}</strong>Selesai
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

