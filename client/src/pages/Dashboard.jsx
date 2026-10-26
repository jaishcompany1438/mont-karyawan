import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ReviewModal from '../components/ReviewModal';
import DelegateTaskModal from '../components/DelegateTaskModal';
import SuccessToast from '../components/SuccessToast';
import { STATUS_LABELS, countTasksByStatus, filterTasksByStatus, getTaskActions, isOverdueToday } from '../utils/taskActions';
import { AlertTriangle, CalendarCheck, ChevronDown, FileSearch, Play, RefreshCw, Send, Users } from 'lucide-react';

const STATUS_FILTERS = [
  ['', 'Semua'],
  ['TO_DO', 'Belum mulai'],
  ['IN_PROGRESS', 'Dikerjakan'],
  ['UNDER_REVIEW', 'Menunggu review'],
  ['REVISION', 'Perlu revisi'],
  ['COMPLETED', 'Selesai'],
];

const STATUS_STYLES = {
  TO_DO: 'border-slate-200 bg-slate-100 text-slate-700',
  IN_PROGRESS: 'border-blue-200 bg-blue-50 text-blue-700',
  UNDER_REVIEW: 'border-amber-200 bg-amber-50 text-amber-800',
  REVISION: 'border-orange-200 bg-orange-50 text-orange-800',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const PRIORITY_STYLES = {
  URGEN: 'border-rose-200 bg-rose-100 text-rose-800',
  TINGGI: 'border-amber-200 bg-amber-100 text-amber-800',
  SEDANG: 'border-blue-200 bg-blue-100 text-blue-800',
  RENDAH: 'border-slate-200 bg-slate-100 text-slate-700',
};

function formatTodayLabel(isoDate) {
  const [year, month, day] = String(isoDate || '').split('-').map(Number);
  const date = year ? new Date(year, month - 1, day) : new Date();
  return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDueTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Hari ini';
  if (date.getHours() === 0 && date.getMinutes() === 0) return 'Sepanjang hari';
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function Dashboard({ refreshKey, onRefresh, onOpenSubmitWork }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [today, setToday] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [reviewTask, setReviewTask] = useState(null);
  const [delegateTask, setDelegateTask] = useState(null);
  const [staff, setStaff] = useState([]);
  const [toast, setToast] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getTodayTasks().then((result) => {
      if (cancelled) return;
      setTasks(result.data || []);
      setToday(result.date || '');
      setError('');
    }).catch((err) => {
      if (!cancelled) setError(err.message);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [refreshKey, reloadKey]);

  // Muat ulang saat tab kembali aktif agar daftar tetap sesuai tanggal hari ini.
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'visible') setReloadKey((value) => value + 1);
    };
    document.addEventListener('visibilitychange', handleVisible);
    return () => document.removeEventListener('visibilitychange', handleVisible);
  }, []);

  useEffect(() => {
    if (user?.role !== 'KABID') return;
    api.getAssignees().then((result) => setStaff(result.data || [])).catch(() => {});
  }, [user?.role]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const startTask = useCallback(async (task) => {
    setBusyId(task.id);
    try {
      await api.updateTaskStatus(task.id, 'IN_PROGRESS');
      setToast('Tugas dimulai.');
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }, [onRefresh]);

  const counts = countTasksByStatus(tasks);
  const visibleTasks = filterTasksByStatus(tasks, status);
  const now = new Date();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Pekerjaan hari ini</p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-900">Dashboard Utama</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Assalamualaikum {user?.nama}, semoga selalu semangat bekerja.
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <CalendarCheck className="h-3.5 w-3.5 text-blue-600" /> {formatTodayLabel(today)}
          </p>
        </div>
        <button
          onClick={() => setReloadKey((value) => value + 1)}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Segarkan
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Filter status tugas hari ini">
        {STATUS_FILTERS.map(([value, label]) => (
          <button
            key={value || 'all'}
            type="button"
            onClick={() => setStatus(value)}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-[11px] font-bold transition ${
              status === value
                ? 'border-blue-600 bg-blue-700 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            {label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${status === value ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-700'}`}>
              {value ? counts[value] || 0 : tasks.length}
            </span>
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Daftar tugas hari ini">
        {loading && !tasks.length ? (
          <p className="p-8 text-center text-xs text-slate-400">Memuat tugas hari ini...</p>
        ) : visibleTasks.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-400">
            {tasks.length ? 'Tidak ada tugas dengan status ini hari ini.' : 'Tidak ada tugas untuk hari ini.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibleTasks.map((task) => {
              const actions = getTaskActions(task, user);
              const overdue = isOverdueToday(task, now);
              const expanded = expandedId === task.id;
              const revisionNote = task.catatan_revisi || task.catatan_reviewer;
              return (
                <li key={task.id} className={`p-4 ${overdue ? 'bg-rose-50/40' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : task.id)}
                      className="flex min-w-0 flex-1 basis-64 items-start gap-2 text-left"
                      aria-expanded={expanded}
                    >
                      <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-bold leading-snug text-slate-900">{task.judul}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-600">{formatDueTime(task.due_date)}</span>
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{task.assignee_nama}</span>
                          <span>{task.nama_bidang}</span>
                        </span>
                      </span>
                    </button>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {overdue && (
                        <span className="flex items-center gap-1 rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                          <AlertTriangle className="h-3 w-3" /> Lewat waktu
                        </span>
                      )}
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${PRIORITY_STYLES[task.prioritas] || PRIORITY_STYLES.RENDAH}`}>{task.prioritas}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[task.status] || STATUS_STYLES.TO_DO}`}>{STATUS_LABELS[task.status] || task.status}</span>
                    </div>
                  </div>

                  {(actions.start || actions.submit || actions.review || actions.delegate) && (
                    <div className="mt-3 flex flex-wrap justify-end gap-1.5">
                      {actions.delegate && (
                        <button type="button" onClick={() => setDelegateTask(task)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100">Delegasikan</button>
                      )}
                      {actions.start && (
                        <button type="button" disabled={busyId === task.id} onClick={() => startTask(task)} className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60">
                          <Play className="h-3 w-3" /> Mulai
                        </button>
                      )}
                      {actions.submit && (
                        <button type="button" onClick={() => onOpenSubmitWork(task)} className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-500">
                          <Send className="h-3 w-3" /> Kirim Bukti
                        </button>
                      )}
                      {actions.review && (
                        <button type="button" onClick={() => setReviewTask(task)} className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-400">
                          <FileSearch className="h-3 w-3" /> Review
                        </button>
                      )}
                    </div>
                  )}

                  {task.status === 'REVISION' && revisionNote && (
                    <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 p-2 text-[11px] leading-relaxed text-orange-900">
                      <span className="block font-bold">Catatan Revisi:</span>
                      <span className="whitespace-pre-wrap break-words">{revisionNote}</span>
                    </div>
                  )}

                  {expanded && (
                    <dl className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <dt className="font-bold text-slate-700">Deskripsi</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap break-words">{task.deskripsi || '-'}</dd>
                      </div>
                      <div><dt className="font-bold text-slate-700">Periode</dt><dd>{task.periode}</dd></div>
                      <div><dt className="font-bold text-slate-700">Dibuat oleh</dt><dd>{task.creator_nama}</dd></div>
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ReviewModal isOpen={Boolean(reviewTask)} task={reviewTask} onClose={() => setReviewTask(null)} onSuccess={onRefresh} />
      <DelegateTaskModal isOpen={Boolean(delegateTask)} task={delegateTask} staff={staff} onClose={() => setDelegateTask(null)} onSuccess={onRefresh} />
      <SuccessToast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
