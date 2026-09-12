import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Calendar,
  User,
  Paperclip,
  CheckCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
  Eye,
  Trash2,
  Edit2
} from 'lucide-react';

export default function TaskTable({
  tasks = [],
  onOpenSubmitWork,
  onOpenReview,
  onOpenEditTask,
  onDeleteTask,
  onStartTask,
  selectedIds = [],
  onSelectionChange
}) {
  const { user } = useAuth();
  const role = user?.role;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'TO_DO':
        return { label: 'To Do', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
      case 'IN_PROGRESS':
        return { label: 'In Progress', cls: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'UNDER_REVIEW':
        return { label: 'Under Review', cls: 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse' };
      case 'REVISION':
        return { label: 'Perlu Revisi', cls: 'bg-orange-100 text-orange-800 border-orange-200' };
      case 'COMPLETED':
        return { label: 'Selesai', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      default:
        return { label: status, cls: 'bg-gray-100 text-gray-700 border-gray-200' };
    }
  };

  const getPriorityBadge = (p) => {
    switch (p) {
      case 'URGEN': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'TINGGI': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'SEDANG': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'RENDAH': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th className="py-3.5 px-2">{role === 'SUPER_ADMIN' && <input type="checkbox" checked={tasks.length > 0 && selectedIds.length === tasks.length} onChange={(e) => onSelectionChange(e.target.checked ? tasks.map((task) => task.id) : [])} />}</th><th className="py-3.5 px-4">Tugas</th>
              <th className="py-3.5 px-3">Periode</th>
              <th className="py-3.5 px-3">Prioritas</th>
              <th className="py-3.5 px-3">Penerima & Bidang</th>
              <th className="py-3.5 px-3">Tenggat Waktu</th>
              <th className="py-3.5 px-3">Status</th>
              <th className="py-3.5 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-10 text-center text-slate-400 font-medium">
                  Tidak ada tugas yang sesuai dengan kriteria filter.
                </td>
              </tr>
            ) : (
              tasks.map((task) => {
                const statusBadge = getStatusBadge(task.status);
                const isOverdue = task.status !== 'COMPLETED' && new Date(task.due_date) < new Date();
                const isAssignee = task.assigned_to === user?.id;
                const canReview = ['SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS'].includes(role) ||
                                  task.created_by === user?.id ||
                                  (role === 'KABID' && task.bidang_id === user?.bidang_id);
                const canEdit = ['SUPER_ADMIN', 'MUDIR'].includes(role) || task.created_by === user?.id;

                return (
                  <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-2">{role === 'SUPER_ADMIN' && <input type="checkbox" checked={selectedIds.includes(task.id)} onChange={(e) => onSelectionChange(e.target.checked ? [...selectedIds, task.id] : selectedIds.filter((id) => id !== task.id))} />}</td>
                    {/* Title & Description */}
                    <td className="py-3.5 px-4 max-w-[260px]">
                      <div className="font-bold text-slate-900 line-clamp-1">{task.judul}</div>
                      <div className="text-[10px] text-slate-500">Anggaran: Rp {Number(task.anggaran_dana || 0).toLocaleString('id-ID')} · Terpakai: Rp {Number(task.anggaran_terpakai || 0).toLocaleString('id-ID')}</div>
                      {task.deskripsi && (
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {task.deskripsi}
                        </div>
                      )}
                      {task.status === 'REVISION' && task.catatan_revisi && (
                        <div className="text-[10px] text-orange-700 bg-orange-50 border border-orange-200 rounded p-1 mt-1 line-clamp-1">
                          Revisi: {task.catatan_revisi}
                        </div>
                      )}
                      {task.file_attachment && (
                        <div className="mt-1">
                          <a
                            href={task.file_attachment}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-[10px] text-emerald-600 hover:underline"
                          >
                            <Paperclip className="w-3 h-3 mr-0.5" /> Lampiran Tugas
                          </a>
                        </div>
                      )}
                    </td>

                    {/* Period */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                        {task.periode}
                      </span>
                    </td>

                    {/* Priority */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPriorityBadge(task.prioritas)}`}>
                        {task.prioritas}
                      </span>
                    </td>

                    {/* Assignee & Bidang */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{task.assignee_nama}</div>
                      <div className="text-[10px] text-slate-500">{task.nama_bidang}{task.assignee_sub_bidang ? ` · ${task.assignee_sub_bidang}` : ''}</div>
                      {task.assignee_no_telepon && <a className="text-[10px] font-semibold text-emerald-700 hover:underline" href={`https://wa.me/${String(task.assignee_no_telepon).replace(/\D/g, '').replace(/^0/, '62')}`} target="_blank" rel="noreferrer">WhatsApp</a>}
                    </td>

                    {/* Due Date */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className={`font-medium ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                        {new Date(task.due_date).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                      {isOverdue && (
                        <span className="text-[10px] text-rose-600 font-semibold flex items-center">
                          <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> Lewat Tenggat
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusBadge.cls}`}>
                        {statusBadge.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* Staf Start */}
                        {task.status === 'TO_DO' && (isAssignee || role === 'SUPER_ADMIN') && (
                          <button
                            onClick={() => onStartTask(task.id)}
                            className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-semibold border border-blue-200"
                          >
                            Mulai
                          </button>
                        )}

                        {/* Staf Submit Work */}
                        {['IN_PROGRESS', 'REVISION'].includes(task.status) && (isAssignee || role === 'SUPER_ADMIN') && (
                          <button
                            onClick={() => onOpenSubmitWork(task)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold"
                          >
                            Kirim Bukti
                          </button>
                        )}

                        {/* Review by Supervisor */}
                        {task.status === 'UNDER_REVIEW' && canReview && (
                          <button
                            onClick={() => onOpenReview(task)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-semibold"
                          >
                            Review
                          </button>
                        )}

                        {/* Edit */}
                        {canEdit && (
                          <button
                            onClick={() => onOpenEditTask(task)}
                            title="Edit Tugas"
                            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete */}
                        {canEdit && (
                          <button
                            onClick={() => onDeleteTask(task.id)}
                            title="Hapus Tugas"
                            className="p-1 text-rose-400 hover:text-rose-700 rounded hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
