import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import PeriodTabs from '../components/PeriodTabs';
import KanbanBoard from '../components/KanbanBoard';
import TaskTable from '../components/TaskTable';
import ReviewModal from '../components/ReviewModal';
import MobileTaskGroups from '../components/MobileTaskGroups';
import { LayoutGrid, List, Search } from 'lucide-react';

export default function Tasks({ refreshKey, onRefresh, onOpenCreateTask, onOpenSubmitWork }) {
  const [period, setPeriod] = useState('');
  const [view, setView] = useState('kanban');
  const [search, setSearch] = useState('');
  const [tasks, setTasks] = useState([]);
  const [reviewTask, setReviewTask] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.getTasks({ periode: period, search }).then((result) => { if (!cancelled) setTasks(result.data || []); }).catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [period, search, refreshKey]);

  const updateStatus = async (id, status) => {
    try { await api.updateTaskStatus(id, status); onRefresh(); } catch (err) { setError(err.message); }
  };
  const deleteTask = async (id) => {
    if (!window.confirm('Hapus tugas ini?')) return;
    try { await api.deleteTask(id); onRefresh(); } catch (err) { setError(err.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Pelacakan pekerjaan</p><h2 className="mt-1 text-2xl font-extrabold text-slate-900">Manajemen Tugas</h2></div><button onClick={onOpenCreateTask} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-600">+ Buat Tugas</button></div>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
      <PeriodTabs selectedPeriod={period} onChange={setPeriod} />
      <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400"><Search className="h-4 w-4" /><input className="w-full outline-none" placeholder="Cari judul, deskripsi, atau penerima..." value={search} onChange={(e) => setSearch(e.target.value)} /></label><div className="flex rounded-xl border border-slate-200 bg-white p-1"><button onClick={() => setView('kanban')} className={`rounded-lg p-2 ${view === 'kanban' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500'}`}><LayoutGrid className="h-4 w-4" /></button><button onClick={() => setView('table')} className={`rounded-lg p-2 ${view === 'table' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500'}`}><List className="h-4 w-4" /></button></div></div>
      <MobileTaskGroups tasks={tasks} onOpenSubmitWork={onOpenSubmitWork} onOpenReview={setReviewTask} onStartTask={(id) => updateStatus(id, 'IN_PROGRESS')} />
      <div className="hidden md:block">
        {view === 'kanban' ? <KanbanBoard tasks={tasks} onOpenSubmitWork={onOpenSubmitWork} onOpenReview={setReviewTask} onStartTask={(id) => updateStatus(id, 'IN_PROGRESS')} /> : <TaskTable tasks={tasks} onOpenSubmitWork={onOpenSubmitWork} onOpenReview={setReviewTask} onStartTask={(id) => updateStatus(id, 'IN_PROGRESS')} onDeleteTask={deleteTask} />}
      </div>
      <ReviewModal isOpen={Boolean(reviewTask)} task={reviewTask} onClose={() => setReviewTask(null)} onSuccess={onRefresh} />
    </div>
  );
}
