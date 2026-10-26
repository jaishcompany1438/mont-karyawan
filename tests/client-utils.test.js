const test = require('node:test');
const assert = require('node:assert/strict');

const loadAccess = () => import('../client/src/utils/access.js');
const loadActions = () => import('../client/src/utils/taskActions.js');

const user = (role, extra = {}) => ({ id: 1, role, bidang_id: 5, ...extra });

test('menu Manajemen Tugas hanya untuk Kabid, Wakil Mudir, Mudir dan Super Admin', async () => {
  const { canAccessTab } = await loadAccess();
  for (const role of ['KABID', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS', 'MUDIR', 'SUPER_ADMIN']) {
    assert.equal(canAccessTab('tasks', user(role)), true, role);
  }
  assert.equal(canAccessTab('tasks', user('STAF')), false);
  assert.equal(canAccessTab('tasks', null), false);
});

test('Staf yang membuka URL #/tasks diarahkan ke dashboard', async () => {
  const { getTabFromHash, resolveAccessibleTab } = await loadAccess();
  const requested = getTabFromHash('#/tasks');
  assert.equal(requested, 'tasks');
  assert.equal(resolveAccessibleTab(requested, user('STAF')), 'dashboard');
  assert.equal(resolveAccessibleTab(requested, user('KABID')), 'tasks');
});

test('hash kosong atau tab tidak dikenal berakhir di dashboard', async () => {
  const { getTabFromHash, resolveAccessibleTab } = await loadAccess();
  assert.equal(getTabFromHash(''), 'dashboard');
  assert.equal(getTabFromHash('#/'), 'dashboard');
  assert.equal(resolveAccessibleTab('tidak-ada', user('SUPER_ADMIN')), 'dashboard');
});

test('halaman terbatas lain tetap dijaga saat diakses langsung', async () => {
  const { canAccessTab } = await loadAccess();
  assert.equal(canAccessTab('users', user('KABID')), false);
  assert.equal(canAccessTab('users', user('MUDIR')), true);
  assert.equal(canAccessTab('cross-requests', user('STAF')), false);
  assert.equal(canAccessTab('patrol', user('STAF')), false);
  assert.equal(canAccessTab('patrol', user('STAF', { can_patroli: 1 })), true);
  assert.equal(canAccessTab('dashboard', user('STAF')), true);
  assert.equal(canAccessTab('reports', user('STAF')), true);
});

test('Staf melihat tombol Mulai dan Kirim Bukti hanya pada tugasnya sendiri', async () => {
  const { getTaskActions } = await loadActions();
  const staf = user('STAF');
  assert.deepEqual(getTaskActions({ status: 'TO_DO', assigned_to: 1 }, staf), { start: true, submit: false, review: false, delegate: false });
  assert.equal(getTaskActions({ status: 'IN_PROGRESS', assigned_to: 1 }, staf).submit, true);
  assert.equal(getTaskActions({ status: 'REVISION', assigned_to: 1 }, staf).submit, true);
  assert.deepEqual(getTaskActions({ status: 'TO_DO', assigned_to: 2 }, staf), { start: false, submit: false, review: false, delegate: false });
  assert.equal(getTaskActions({ status: 'UNDER_REVIEW', assigned_to: 1 }, staf).review, false);
  assert.equal(getTaskActions({ status: 'COMPLETED', assigned_to: 1 }, staf).submit, false);
});

test('Kabid hanya me-review tugas Staf di bidangnya dan bisa mendelegasikan', async () => {
  const { getTaskActions } = await loadActions();
  const kabid = user('KABID');
  const base = { status: 'UNDER_REVIEW', bidang_id: 5, assignee_role: 'STAF', assigned_to: 9, created_by: 1 };
  assert.equal(getTaskActions(base, kabid).review, true);
  assert.equal(getTaskActions({ ...base, bidang_id: 6 }, kabid).review, false);
  assert.equal(getTaskActions({ ...base, assignee_role: 'KABID' }, kabid).review, false);
  assert.equal(getTaskActions({ ...base, status: 'TO_DO' }, kabid).delegate, true);
  assert.equal(getTaskActions({ ...base, created_by: 77 }, kabid).delegate, false);
});

test('Mudir dan Wakil Mudir dapat me-review semua tugas yang menunggu review', async () => {
  const { getTaskActions } = await loadActions();
  for (const role of ['MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'SUPER_ADMIN']) {
    assert.equal(getTaskActions({ status: 'UNDER_REVIEW', assigned_to: 9, bidang_id: 99 }, user(role)).review, true, role);
  }
});

test('filter status dan penghitung status dashboard', async () => {
  const { filterTasksByStatus, countTasksByStatus } = await loadActions();
  const tasks = [{ status: 'TO_DO' }, { status: 'TO_DO' }, { status: 'COMPLETED' }];
  assert.equal(filterTasksByStatus(tasks, '').length, 3);
  assert.equal(filterTasksByStatus(tasks, 'TO_DO').length, 2);
  assert.deepEqual(countTasksByStatus(tasks), { TO_DO: 2, COMPLETED: 1 });
});

test('tugas sepanjang hari (00:00) tidak langsung dianggap terlambat', async () => {
  const { isOverdueToday } = await loadActions();
  const now = new Date(2026, 9, 26, 17, 0, 0);
  assert.equal(isOverdueToday({ status: 'TO_DO', due_date: new Date(2026, 9, 26, 0, 0, 0) }, now), false);
  assert.equal(isOverdueToday({ status: 'TO_DO', due_date: new Date(2026, 9, 26, 9, 30, 0) }, now), true);
  assert.equal(isOverdueToday({ status: 'COMPLETED', due_date: new Date(2026, 9, 26, 9, 30, 0) }, now), false);
  assert.equal(isOverdueToday({ status: 'TO_DO', due_date: new Date(2026, 9, 26, 18, 0, 0) }, now), false);
});
