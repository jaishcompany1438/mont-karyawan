import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Paperclip,
  FileCheck,
  User,
  ChevronRight,
  RotateCcw,
  Calendar
} from 'lucide-react';

export default function KanbanBoard({
  tasks = [],
  onOpenSubmitWork,
  onOpenReview,
  onOpenEditTask,
  onStartTask
}) {
  const { user } = useAuth();
  const role = user?.role;

  const columns = [
    { id: 'TO_DO', title: 'Belum Mulai (To Do)', color: 'border-slate-300 bg-slate-100/70 text-slate-700' },
    { id: 'IN_PROGRESS', title: 'Sedang Dikerjakan', color: 'border-blue-300 bg-blue-50/70 text-blue-700' },
    { id: 'UNDER_REVIEW', title: 'Menunggu Review', color: 'border-amber-300 bg-amber-50/70 text-amber-800' },
    { id: 'REVISION', title: 'Perlu Revisi', color: 'border-orange-300 bg-orange-50/70 text-orange-800' },
    { id: 'COMPLETED', title: 'Selesai (Approved)', color: 'border-emerald-300 bg-emerald-50/70 text-emerald-800' },
  ];

  const getPriorityBadge = (p) => {
    switch (p) {
      case 'URGEN': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'TINGGI': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'SEDANG': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'RENDAH': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPeriodBadge = (period) => {
    switch (period) {
      case 'HARIAN': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PEKANAN': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'BULANAN': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'TAHUNAN': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'INSIDENTAL': return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const isOverdue = (dueDate, status) => {
    return status !== 'COMPLETED' && new Date(dueDate) < new Date();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);

        return (
          <div
            key={col.id}
            className="flex flex-col rounded-2xl bg-slate-100/80 border border-slate-200 p-3 min-w-[280px]"
          >
            {/* Column Header */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl border mb-3 font-bold text-xs ${col.color}`}>
              <span>{col.title}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-white shadow-xs font-extrabold">
                {colTasks.length}
              </span>
            </div>

            {/* Task Cards Container */}
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
              {colTasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-xl">
                  Tidak ada tugas
                </div>
              ) : (
                colTasks.map((task) => {
                  const overdue = isOverdue(task.due_date, task.status);
                  const isAssignee = task.assigned_to === user?.id;
                  const canReview = ['SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS'].includes(role) ||
                                    (role === 'KABID' && task.bidang_id === user?.bidang_id
                                      && task.assignee_role === 'STAF' && ['KABID', 'STAF'].includes(task.creator_role));

                  return (
                    <div
                      key={task.id}
                      className={`bg-white rounded-xl border p-3.5 shadow-sm hover:shadow-md transition-shadow relative ${
                        overdue ? 'border-rose-300 ring-1 ring-rose-300' : 'border-slate-200'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-1 mb-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getPeriodBadge(task.periode)}`}>
                          {task.periode}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getPriorityBadge(task.prioritas)}`}>
                          {task.prioritas}
                        </span>
                      </div>

                      {/* Title */}
                      <h4
                        onClick={() => onOpenEditTask && onOpenEditTask(task)}
                        className="text-xs font-bold text-slate-800 hover:text-emerald-700 cursor-pointer line-clamp-2 leading-snug mb-1"
                      >
                        {task.judul}
                      </h4>

                      {/* Description */}
                      {task.deskripsi && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 mb-2">
                          {task.deskripsi}
                        </p>
                      )}

                      {/* Catatan Revisi Warning */}
                      {task.status === 'REVISION' && task.catatan_revisi && (
                        <div className="mb-2 p-2 bg-orange-50 border border-orange-200 rounded-lg text-[11px] text-orange-900">
                          <span className="font-bold block">Catatan Revisi:</span>
                          {task.catatan_revisi}
                        </div>
                      )}

                      {/* Department & Assignee */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 mb-2">
                        <div className="flex items-center space-x-1 font-medium truncate">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{task.assignee_nama}{task.assignee_sub_bidang ? ` · ${task.assignee_sub_bidang}` : ''}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium truncate max-w-[90px]">
                          {task.kode_bidang}
                        </span>
                      </div>
                      <div className="mb-2 text-[10px] text-slate-500">
                        Anggaran: Rp {Number(task.anggaran_dana || 0).toLocaleString('id-ID')} · Sisa: Rp {(Number(task.anggaran_dana || 0) - Number(task.anggaran_terpakai || 0)).toLocaleString('id-ID')}
                        {task.assignee_no_telepon && <a className="ml-2 font-semibold text-emerald-700 hover:underline" href={`https://wa.me/${String(task.assignee_no_telepon).replace(/\D/g, '').replace(/^0/, '62')}`} target="_blank" rel="noreferrer">WhatsApp</a>}
                      </div>

                      {/* Due Date & Proof Indicators */}
                      <div className="flex items-center justify-between text-[10px]">
                        <div className={`flex items-center space-x-1 ${overdue ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                          <Calendar className="w-3 h-3" />
                          <span>
                            {new Date(task.due_date).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short'
                            })}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          {task.file_attachment && (
                            <a
                              href={task.file_attachment}
                              target="_blank"
                              rel="noreferrer"
                              title="Unduh Lampiran Tugas"
                              className="text-slate-400 hover:text-slate-700"
                            >
                              <Paperclip className="w-3 h-3" />
                            </a>
                          )}
                          {task.bukti_kerja && (
                            <span title="Bukti Kerja Ada" className="text-emerald-600">
                              <FileCheck className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons based on Role & Status */}
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                        {/* Staf starts task */}
                        {task.status === 'TO_DO' && (isAssignee || role === 'SUPER_ADMIN') && (
                          <button
                            onClick={() => onStartTask(task.id)}
                            className="w-full py-1 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold border border-blue-200 transition-colors"
                          >
                            Mulai Kerjakan
                          </button>
                        )}

                        {/* Staf submits work */}
                        {['IN_PROGRESS', 'REVISION'].includes(task.status) && (isAssignee || role === 'SUPER_ADMIN') && (
                          <button
                            onClick={() => onOpenSubmitWork(task)}
                            className="w-full py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors shadow-xs"
                          >
                            {task.status === 'REVISION' ? 'Kirim Ulang Bukti' : 'Kirim Bukti Kerja'}
                          </button>
                        )}

                        {/* Mudir / Kabid reviews */}
                        {task.status === 'UNDER_REVIEW' && canReview && (
                          <button
                            onClick={() => onOpenReview(task)}
                            className="w-full py-1 px-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold transition-colors shadow-xs animate-pulse"
                          >
                            Verifikasi & Review
                          </button>
                        )}

                        {/* Completed action indicator */}
                        {task.status === 'COMPLETED' && (
                          <span className="text-[11px] text-emerald-700 font-medium flex items-center">
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Selesai
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
