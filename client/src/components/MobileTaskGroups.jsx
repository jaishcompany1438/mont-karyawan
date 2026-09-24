import React from 'react';
import { AlertTriangle, Calendar, CheckCircle2, Clock, FileSearch, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const groups = [
  { id: 'completed', title: 'Telah Selesai', icon: CheckCircle2, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { id: 'active', title: 'Belum Selesai / Dikerjakan', icon: Clock, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { id: 'overdue', title: 'Lewat Waktu', icon: AlertTriangle, color: 'text-rose-700 bg-rose-50 border-rose-200' }
];

function getGroup(task) {
  if (task.status === 'COMPLETED') return 'completed';
  if (new Date(task.due_date) < new Date()) return 'overdue';
  return 'active';
}

function statusLabel(status) {
  return {
    TO_DO: 'Belum mulai',
    IN_PROGRESS: 'Sedang dikerjakan',
    UNDER_REVIEW: 'Menunggu review',
    REVISION: 'Perlu revisi',
    COMPLETED: 'Selesai'
  }[status] || status;
}

export default function MobileTaskGroups({ tasks = [], onOpenSubmitWork, onOpenReview, onStartTask, onOpenDelegate }) {
  const { user } = useAuth();
  const role = user?.role;
  const [expandedTitle, setExpandedTitle] = React.useState(null);
  const canReview = (task) => ['SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS'].includes(role)
    || (role === 'KABID' && task.bidang_id === user?.bidang_id
      && task.assignee_role === 'STAF' && ['KABID', 'STAF'].includes(task.creator_role));

  return (
    <div className="space-y-3 md:hidden">
      {groups.map((group) => {
        const Icon = group.icon;
        const groupTasks = tasks.filter((task) => getGroup(task) === group.id);
        return (
          <section key={group.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={`flex items-center justify-between border-b px-4 py-3 ${group.color}`}>
              <h3 className="flex items-center gap-2 text-xs font-extrabold"><Icon className="h-4 w-4" />{group.title}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold">{groupTasks.length}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {groupTasks.map((task) => {
                const isAssignee = task.assigned_to === user?.id;
                return (
                  <article key={task.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="relative min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setExpandedTitle(expandedTitle === task.id ? null : task.id)}
                          className="block w-full text-left"
                          aria-label={`Baca judul lengkap: ${task.judul}`}
                        >
                          <h4 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900">{task.judul}</h4>
                        </button>
                        {expandedTitle === task.id && (
                          <div className="absolute bottom-full left-0 z-20 mb-2 w-full rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 text-xs font-medium leading-relaxed text-white shadow-lg">
                            {task.judul}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{task.prioritas}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(task.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span>{task.assignee_nama}{task.assignee_sub_bidang ? ` · ${task.assignee_sub_bidang}` : ''}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-bold ${group.id === 'overdue' ? 'text-rose-600' : group.id === 'completed' ? 'text-blue-600' : 'text-blue-600'}`}>{statusLabel(task.status)}</span>
                      <div className="flex gap-1.5">
                        {role === 'KABID' && task.bidang_id === user?.bidang_id && (task.created_by === user?.id || task.assigned_to === user?.id) && <button onClick={() => onOpenDelegate(task)} className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[10px] font-bold text-blue-700">Delegasikan</button>}
                        {task.status === 'TO_DO' && (isAssignee || role === 'SUPER_ADMIN') && <button onClick={() => onStartTask(task.id)} className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[10px] font-bold text-blue-700"><Play className="h-3 w-3" /> Mulai</button>}
                        {['IN_PROGRESS', 'REVISION'].includes(task.status) && (isAssignee || role === 'SUPER_ADMIN') && <button onClick={() => onOpenSubmitWork(task)} className="rounded-lg bg-blue-600 px-2 py-1.5 text-[10px] font-bold text-white">Kirim Bukti</button>}
                        {task.status === 'UNDER_REVIEW' && canReview(task) && <button onClick={() => onOpenReview(task)} className="flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-1.5 text-[10px] font-bold text-white"><FileSearch className="h-3 w-3" /> Review</button>}
                      </div>
                    </div>
                  </article>
                );
              })}
              {!groupTasks.length && <p className="p-5 text-center text-xs text-slate-400">Tidak ada tugas di kelompok ini.</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
