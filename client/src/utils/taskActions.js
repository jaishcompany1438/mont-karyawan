const REVIEWER_ROLES = ['SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS'];

export const STATUS_LABELS = {
  TO_DO: 'Belum mulai',
  IN_PROGRESS: 'Sedang dikerjakan',
  UNDER_REVIEW: 'Menunggu review',
  REVISION: 'Perlu revisi',
  COMPLETED: 'Selesai',
};

// Aksi yang tersedia untuk sebuah tugas, sama dengan aturan di Kanban/daftar mobile.
export function getTaskActions(task, user) {
  if (!task || !user) return { start: false, submit: false, review: false, delegate: false };

  const role = user.role;
  const isAssignee = task.assigned_to === user.id;
  const canWork = isAssignee || role === 'SUPER_ADMIN';
  const canReview = REVIEWER_ROLES.includes(role)
    || (role === 'KABID' && task.bidang_id === user.bidang_id && task.assignee_role === 'STAF');

  return {
    start: task.status === 'TO_DO' && canWork,
    submit: ['IN_PROGRESS', 'REVISION'].includes(task.status) && canWork,
    review: task.status === 'UNDER_REVIEW' && canReview,
    delegate: role === 'KABID' && task.bidang_id === user.bidang_id
      && (task.created_by === user.id || task.assigned_to === user.id),
  };
}

// Tugas bertenggat 00:00 dianggap sepanjang hari, jadi baru terlambat setelah hari berganti.
export function isOverdueToday(task, now = new Date()) {
  if (!task || task.status === 'COMPLETED') return false;
  const due = new Date(task.due_date);
  if (Number.isNaN(due.getTime())) return false;
  const isAllDay = due.getHours() === 0 && due.getMinutes() === 0;
  return !isAllDay && due < now;
}

export function filterTasksByStatus(tasks = [], status = '') {
  return status ? tasks.filter((task) => task.status === status) : tasks;
}

export function filterDashboardTasks(tasks = [], filters = {}) {
  const search = String(filters.search || '').trim().toLocaleLowerCase();
  return tasks.filter((task) => {
    const matchesSearch = !search
      || [task.judul, task.deskripsi, task.assignee_nama]
        .some((value) => String(value || '').toLocaleLowerCase().includes(search));
    const matchesStatus = !filters.status || task.status === filters.status;
    const matchesPriority = !filters.priority || task.prioritas === filters.priority;
    const matchesAssignee = !filters.assigneeId
      || String(task.assigned_to) === String(filters.assigneeId);
    return matchesSearch && matchesStatus && matchesPriority && matchesAssignee;
  });
}

export function canDeleteTask(task, user) {
  if (!task || !user || String(task.assigned_to) === String(user.id)) return false;
  return ['SUPER_ADMIN', 'MUDIR'].includes(user.role)
    || (task.created_by === user.id && user.role !== 'KABID');
}

export function countTasksByStatus(tasks = []) {
  return tasks.reduce((acc, task) => ({ ...acc, [task.status]: (acc[task.status] || 0) + 1 }), {});
}
