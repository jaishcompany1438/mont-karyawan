import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PeriodTabs from '../components/PeriodTabs';
import KanbanBoard from '../components/KanbanBoard';
import TaskTable from '../components/TaskTable';
import ReviewModal from '../components/ReviewModal';
import MobileTaskGroups from '../components/MobileTaskGroups';
import { LayoutGrid, List, Search } from 'lucide-react';

export default function Tasks({ refreshKey, onRefresh, onOpenCreateTask, onOpenEditTask, onOpenSubmitWork, initialFilters = {} }) {
  const { user } = useAuth();
  const [period, setPeriod] = useState(initialFilters.periode || '');
  const [bidangId, setBidangId] = useState(initialFilters.bidang_id || '');
  const [view, setView] = useState('kanban');
  const [search, setSearch] = useState('');
  const [tasks, setTasks] = useState([]);
  const [reviewTask, setReviewTask] = useState(null);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [status, setStatus] = useState(initialFilters.status || '');
  const [prioritas, setPrioritas] = useState('');
  const [kategori, setKategori] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [bidang, setBidang] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api.getTasks({ periode: period, bidang_id: bidangId, status, prioritas, kategori, assigned_to: assignedTo, search }).then((result) => { if (!cancelled) setTasks(result.data || []); }).catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [period, bidangId, status, prioritas, kategori, assignedTo, search, refreshKey]);
  useEffect(() => {
    Promise.all([api.getAssignees(), api.getBidang()]).then(([users, departments]) => {
      setAssignees(users.data || []);
      setBidang(departments.data || []);
    }).catch((err) => setError(err.message));
  }, []);

  const updateStatus = async (id, status) => {
    try { await api.updateTaskStatus(id, status); onRefresh(); } catch (err) { setError(err.message); }
  };
  const deleteTask = async (id) => {
    if (!window.confirm('Hapus tugas ini?')) return;
    try { await api.deleteTask(id); onRefresh(); } catch (err) { setError(err.message); }
  };
  const deleteSelected = async () => {
    if (!selectedIds.length || !window.confirm(`Hapus ${selectedIds.length} program kerja?`)) return;
    try { await api.deleteTasks(selectedIds); setSelectedIds([]); onRefresh(); } catch (err) { setError(err.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Pelacakan pekerjaan</p><h2 className="mt-1 text-2xl font-extrabold text-slate-900">Manajemen Tugas</h2>{bidangId && <p className="mt-1 text-xs font-semibold text-slate-500">Filter bidang aktif</p>}</div><button onClick={onOpenCreateTask} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-600">+ Buat Tugas</button></div>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
      <PeriodTabs selectedPeriod={period} onChange={setPeriod} />
      <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400"><Search className="h-4 w-4" /><input className="w-full outline-none" placeholder="Cari judul, deskripsi, atau penerima..." value={search} onChange={(e) => setSearch(e.target.value)} /></label><div className="flex gap-2"><button onClick={() => setFiltersOpen((value) => !value)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${filtersOpen ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}>Filter Detail</button><div className="flex rounded-xl border border-slate-200 bg-white p-1"><button onClick={() => setView('kanban')} className={`rounded-lg p-2 ${view === 'kanban' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500'}`}><LayoutGrid className="h-4 w-4" /></button><button onClick={() => setView('table')} className={`rounded-lg p-2 ${view === 'table' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500'}`}><List className="h-4 w-4" /></button></div></div></div>
      {filtersOpen && <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5"><select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border px-3 py-2 text-xs"><option value="">Semua status</option><option value="TO_DO">Belum mulai</option><option value="IN_PROGRESS">Sedang dikerjakan</option><option value="UNDER_REVIEW">Menunggu review</option><option value="REVISION">Perlu revisi</option><option value="COMPLETED">Selesai</option></select><select value={prioritas} onChange={(e) => setPrioritas(e.target.value)} className="rounded-xl border px-3 py-2 text-xs"><option value="">Semua prioritas</option><option>RENDAH</option><option>SEDANG</option><option>TINGGI</option><option>URGEN</option></select><select value={kategori} onChange={(e) => setKategori(e.target.value)} className="rounded-xl border px-3 py-2 text-xs"><option value="">Semua kategori</option><option>RUTIN</option><option>PROYEK</option><option>MENDADAK</option></select><select value={bidangId} onChange={(e) => setBidangId(e.target.value)} className="rounded-xl border px-3 py-2 text-xs"><option value="">Semua bidang</option>{bidang.map((item) => <option key={item.id} value={item.id}>{item.nama_bidang}</option>)}</select><select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="rounded-xl border px-3 py-2 text-xs"><option value="">Semua penerima</option>{assignees.map((item) => <option key={item.id} value={item.id}>{item.nama}</option>)}</select></div>}
      <MobileTaskGroups tasks={tasks} onOpenSubmitWork={onOpenSubmitWork} onOpenReview={setReviewTask} onStartTask={(id) => updateStatus(id, 'IN_PROGRESS')} />
      {user?.role === 'SUPER_ADMIN' && selectedIds.length > 0 && <button onClick={deleteSelected} className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white">Hapus {selectedIds.length} terpilih</button>}
      <div className="hidden md:block">
        {view === 'kanban' ? <KanbanBoard tasks={tasks} onOpenEditTask={onOpenEditTask} onOpenSubmitWork={onOpenSubmitWork} onOpenReview={setReviewTask} onStartTask={(id) => updateStatus(id, 'IN_PROGRESS')} /> : <TaskTable tasks={tasks} selectedIds={selectedIds} onSelectionChange={setSelectedIds} onOpenEditTask={onOpenEditTask} onOpenSubmitWork={onOpenSubmitWork} onOpenReview={setReviewTask} onStartTask={(id) => updateStatus(id, 'IN_PROGRESS')} onDeleteTask={deleteTask} />}
      </div>
      <ReviewModal isOpen={Boolean(reviewTask)} task={reviewTask} onClose={() => setReviewTask(null)} onSuccess={onRefresh} />
    </div>
  );
}
