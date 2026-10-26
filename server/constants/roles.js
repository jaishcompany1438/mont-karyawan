// Peran yang boleh membuka menu Manajemen Tugas (GET /api/tasks).
// WADIR_PEND dan WADIR_PENGS adalah Wakil Mudir per cabang.
const TASK_MANAGEMENT_ROLES = ['SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS', 'KABID'];

module.exports = { TASK_MANAGEMENT_ROLES };
