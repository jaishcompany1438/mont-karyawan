const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

// Ganti modul database dengan pool palsu sebelum aplikasi dimuat.
const dbPath = require.resolve('../server/config/db');
const queryLog = [];
let queryHandler = () => [];
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    initDB: async () => {},
    isDbConnected: () => true,
    generateDueRecurringTasks: async () => 0,
    getPool: () => ({
      query: async (sql, params = []) => {
        queryLog.push({ sql, params });
        return [queryHandler(sql, params)];
      },
      getConnection: async () => ({
        beginTransaction: async () => queryLog.push({ sql: 'BEGIN TRANSACTION', params: [] }),
        query: async (sql, params = []) => {
          queryLog.push({ sql, params });
          return [queryHandler(sql, params)];
        },
        commit: async () => queryLog.push({ sql: 'COMMIT', params: [] }),
        rollback: async () => queryLog.push({ sql: 'ROLLBACK', params: [] }),
        release: () => queryLog.push({ sql: 'RELEASE', params: [] })
      })
    })
  }
};

const { app } = require('../server/index');
const { JWT_SECRET } = require('../server/middleware/auth');
const { getTodayRange } = require('../server/utils/dateRange');
const { aggregateReportRows, getReportRows } = require('../server/controllers/reportController');
const { parseExecutorIds } = require('../server/controllers/taskController');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));
test.beforeEach(() => {
  queryLog.length = 0;
  queryHandler = () => [];
});

const users = {
  STAF: { id: 11, role: 'STAF', bidang_id: 1, nama: 'Staf' },
  KABID: { id: 21, role: 'KABID', bidang_id: 1, nama: 'Kabid' },
  WAKIL_MUDIR: { id: 31, role: 'WAKIL_MUDIR', bidang_id: null, nama: 'Wakil' },
  WADIR_PEND: { id: 32, role: 'WADIR_PEND', bidang_id: null, nama: 'Wadir' },
  MUDIR: { id: 41, role: 'MUDIR', bidang_id: null, nama: 'Mudir' },
  SUPER_ADMIN: { id: 51, role: 'SUPER_ADMIN', bidang_id: null, nama: 'Admin' }
};

function request(path, role, options = {}) {
  const token = jwt.sign(users[role], JWT_SECRET, { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}`, ...options.headers };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers
  });
}

test('getTodayRange mengembalikan batas hari ini [00:00, besok 00:00)', () => {
  assert.deepEqual(getTodayRange(new Date(2026, 9, 26, 17, 24, 6)), {
    start: '2026-10-26 00:00:00',
    end: '2026-10-27 00:00:00'
  });
  assert.deepEqual(getTodayRange(new Date(2026, 11, 31, 23, 59, 59)), {
    start: '2026-12-31 00:00:00',
    end: '2027-01-01 00:00:00'
  });
  assert.deepEqual(getTodayRange(new Date(2026, 0, 1, 0, 0, 0)), {
    start: '2026-01-01 00:00:00',
    end: '2026-01-02 00:00:00'
  });
});

test('GET /api/tasks/today hanya mengambil tugas pada tanggal hari ini', async () => {
  const { start, end } = getTodayRange();
  const tasks = [
    { id: 1, judul: 'Kemarin', due_date: '2000-01-01 08:00:00' },
    { id: 2, judul: 'Hari ini', due_date: start.replace('00:00:00', '09:00:00') },
    { id: 3, judul: 'Besok', due_date: end.replace('00:00:00', '09:00:00') }
  ];
  queryHandler = (sql, params) => tasks.filter((task) => task.due_date >= params[0] && task.due_date < params[1]);

  const response = await request('/api/tasks/today', 'MUDIR');
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.date, start.slice(0, 10));
  assert.deepEqual(body.data.map((task) => task.judul), ['Hari ini']);
  assert.match(queryLog[0].sql, /t\.due_date >= \? AND t\.due_date < \?/);
  assert.deepEqual(queryLog[0].params.slice(0, 2), [start, end]);
});

test('GET /api/tasks/today mengurutkan tugas selesai terakhir lalu waktu dan prioritas', async () => {
  await request('/api/tasks/today', 'SUPER_ADMIN');
  assert.match(queryLog[0].sql, /ORDER BY CASE WHEN t\.status = 'COMPLETED' THEN 1 ELSE 0 END ASC,\s+t\.due_date ASC,\s+FIELD\(t\.prioritas, 'URGEN', 'TINGGI', 'SEDANG', 'RENDAH'\) ASC/);
});

test('GET /api/tasks/today tetap membatasi visibilitas sesuai peran', async () => {
  await request('/api/tasks/today', 'STAF');
  assert.match(queryLog[0].sql, /t\.assigned_to = \?/);
  assert.equal(queryLog[0].params.at(-1), users.STAF.id);

  queryLog.length = 0;
  await request('/api/tasks/today', 'KABID');
  assert.match(queryLog[0].sql, /t\.bidang_id = \? OR t\.created_by = \? OR t\.assigned_to = \?/);
  assert.deepEqual(queryLog[0].params.slice(2), [users.KABID.bidang_id, users.KABID.id, users.KABID.id]);
});

test('GET /api/tasks/today menolak permintaan tanpa token', async () => {
  const response = await fetch(`${baseUrl}/api/tasks/today`);
  assert.equal(response.status, 401);
});

for (const role of ['KABID', 'WAKIL_MUDIR', 'WADIR_PEND', 'MUDIR', 'SUPER_ADMIN']) {
  test(`GET /api/tasks (Manajemen Tugas) diizinkan untuk ${role}`, async () => {
    const response = await request('/api/tasks', role);
    assert.equal(response.status, 200);
  });
}

test('GET /api/tasks (Manajemen Tugas) ditolak untuk STAF dengan 403 tanpa query ke database', async () => {
  const response = await request('/api/tasks', 'STAF');
  assert.equal(response.status, 403);
  assert.equal(queryLog.length, 0);
});

test('Staf bisa memulai tugasnya sendiri dari dashboard (PATCH status)', async () => {
  queryHandler = (sql) => (sql.startsWith('SELECT') ? [{ id: 7, assigned_to: users.STAF.id, bidang_id: 1 }] : {});

  const response = await request('/api/tasks/7/status', 'STAF', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'IN_PROGRESS' })
  });

  assert.equal(response.status, 200);
  const update = queryLog.find((entry) => entry.sql.includes('UPDATE tasks'));
  assert.ok(update, 'UPDATE tasks harus dijalankan');
  assert.deepEqual(update.params, ['IN_PROGRESS', users.STAF.id, '7']);
});

test('Staf tidak bisa memulai tugas milik orang lain', async () => {
  queryHandler = (sql) => (sql.startsWith('SELECT') ? [{ id: 8, assigned_to: 999, bidang_id: 1 }] : {});

  const response = await request('/api/tasks/8/status', 'STAF', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'IN_PROGRESS' })
  });

  assert.equal(response.status, 403);
  assert.equal(queryLog.some((entry) => entry.sql.includes('UPDATE tasks')), false);
});

test('WADIR_PEND dapat mengekspor hanya tugas bidang di bawah koordinasinya', async () => {
  await getReportRows({
    user: users.WADIR_PEND,
    query: { scope: 'coordinated', bidang_id: '8' }
  });

  assert.match(queryLog[0].sql, /AND b\.parent_role = \?/);
  assert.match(queryLog[0].sql, /AND t\.bidang_id = \?/);
  assert.deepEqual(queryLog[0].params, ['WADIR_PEND', '8']);
});

test('WADIR_PENGS hanya dapat mengekspor bidang di cabangnya sendiri', async () => {
  await getReportRows({
    user: { ...users.WADIR_PEND, role: 'WADIR_PENGS' },
    query: { scope: 'coordinated' }
  });

  assert.match(queryLog[0].sql, /AND b\.parent_role = \?/);
  assert.deepEqual(queryLog[0].params, ['WADIR_PENGS']);
});

test('WAKIL_MUDIR dengan cabang koordinasi dapat mengekspor tugas di cabang tersebut', async () => {
  await getReportRows({
    user: { ...users.WAKIL_MUDIR, parent_role: 'WADIR_PEND' },
    query: { scope: 'coordinated' }
  });

  assert.match(queryLog[0].sql, /AND b\.parent_role = \?/);
  assert.deepEqual(queryLog[0].params, ['WADIR_PEND']);
});

test('Ekspor tugas pribadi WADIR tetap hanya mencakup tugas yang dibuat atau ditugaskan kepadanya', async () => {
  await getReportRows({
    user: users.WADIR_PEND,
    query: { scope: 'own', own_tasks: '1' }
  });

  assert.match(queryLog[0].sql, /AND \(t\.created_by = \? OR t\.assigned_to = \?\)/);
  assert.doesNotMatch(queryLog[0].sql, /b\.parent_role = \?/);
  assert.deepEqual(queryLog[0].params, [users.WADIR_PEND.id, users.WADIR_PEND.id]);
});

test('getReportRows memuat seluruh nama pelaksana yang terkait dengan tugas', async () => {
  queryHandler = (sql) => {
    if (sql.includes('FROM tasks t')) return [{ id: 7, judul: 'Tugas laporan' }];
    if (sql.includes('FROM task_executors te')) {
      return [
        { task_id: 7, nama: 'Pelaksana Satu' },
        { task_id: 7, nama: 'Pelaksana Dua' }
      ];
    }
    return [];
  };

  const rows = await getReportRows({ user: users.MUDIR, query: {} });

  assert.deepEqual(rows[0].pelaksana_names, ['Pelaksana Satu', 'Pelaksana Dua']);
  assert.match(queryLog[1].sql, /FROM task_executors te/);
});

test('Wakil Mudir umum tidak dapat meminta ekspor laporan bidang koordinasi', async () => {
  const response = await request('/api/reports/export/excel?scope=coordinated', 'WAKIL_MUDIR');

  assert.equal(response.status, 403);
  assert.equal(queryLog.length, 0);
});

test('WAKIL_MUDIR tanpa cabang koordinasi ditolak untuk ekspor bidang koordinasi', async () => {
  const token = jwt.sign({ ...users.WAKIL_MUDIR, parent_role: null }, JWT_SECRET, { expiresIn: '1h' });
  const response = await fetch(`${baseUrl}/api/reports/export/excel?scope=coordinated`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  assert.equal(response.status, 403);
  assert.equal(queryLog.length, 0);
});

test('parseExecutorIds menerima beberapa pengguna dan menghapus ID duplikat', () => {
  assert.deepEqual(parseExecutorIds(['11', 12, '11']), [11, 12]);
});

test('parseExecutorIds menolak daftar kosong dan ID yang tidak valid', () => {
  assert.throws(() => parseExecutorIds([]), /Pilih setidaknya satu pelaksana/);
  assert.throws(() => parseExecutorIds(['12x']), /Pilihan pelaksana tugas tidak valid/);
  assert.throws(() => parseExecutorIds(['0']), /Pilihan pelaksana tugas tidak valid/);
});

test('Super Admin dapat menyimpan beberapa pelaksana saat mengirim hasil tugas', async () => {
  queryHandler = (sql, params = []) => {
    if (sql.startsWith('SELECT t.*, b.parent_role')) {
      return [{
        id: 7,
        judul: 'Tugas uji',
        created_by: 88,
        assigned_to: 99,
        anggaran_dana: 100,
        bukti_kerja: '/uploads/bukti-lama.pdf'
      }];
    }
    if (sql.startsWith('SELECT id, nama FROM users WHERE id IN')) {
      return params.map((id) => ({ id: Number(id), nama: `Pengguna ${id}` }));
    }
    return [];
  };
  const form = new FormData();
  form.append('anggaran_terpakai', '0');
  form.append('pelaksana_ids', '11');
  form.append('pelaksana_ids', '12');

  const response = await request('/api/tasks/7/submit-review', 'SUPER_ADMIN', {
    method: 'POST',
    body: form
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(queryLog.find((entry) => entry.sql.startsWith('SELECT id, nama FROM users WHERE id IN')).params, [11, 12]);
  const associationInsert = queryLog.find((entry) => entry.sql.startsWith('INSERT INTO task_executors'));
  assert.ok(associationInsert);
  assert.deepEqual(associationInsert.params, ['7', 11, '7', 12]);
  const taskUpdate = queryLog.find((entry) => entry.sql.startsWith('UPDATE tasks SET status'));
  assert.equal(taskUpdate.params[4], 11);
  assert.ok(queryLog.some((entry) => entry.sql === 'COMMIT'));
});

test('Super Admin dapat mengubah daftar pelaksana saat menyetujui tugas', async () => {
  queryHandler = (sql, params = []) => {
    if (sql.startsWith('SELECT t.*, creator.role AS creator_role')) {
      return [{
        id: 7,
        judul: 'Tugas uji',
        created_by: 88,
        assigned_to: 99,
        bidang_id: 1,
        status: 'UNDER_REVIEW',
        completed_by: 99,
        assignee_role: 'STAF'
      }];
    }
    if (sql.startsWith('SELECT parent_role FROM bidang')) return [{ parent_role: null }];
    if (sql.startsWith('SELECT id, nama FROM users WHERE id IN')) {
      return params.map((id) => ({ id: Number(id), nama: `Pengguna ${id}` }));
    }
    return [];
  };

  const response = await request('/api/tasks/7/review', 'SUPER_ADMIN', {
    method: 'POST',
    body: JSON.stringify({
      action: 'APPROVE',
      nilai_sop: 4,
      nilai_waktu: 4,
      nilai_kualitas: 5,
      pelaksana_ids: [11, 12]
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  const associationInsert = queryLog.find((entry) => entry.sql.startsWith('INSERT INTO task_executors'));
  assert.ok(associationInsert);
  assert.deepEqual(associationInsert.params, ['7', 11, '7', 12]);
  const taskUpdate = queryLog.find((entry) => entry.sql.startsWith('UPDATE tasks SET status'));
  assert.equal(taskUpdate.params[7], 11);
  assert.ok(queryLog.some((entry) => entry.sql === 'COMMIT'));
});

test('pengguna selain Super Admin tidak dapat menentukan pelaksana', async () => {
  queryHandler = (sql) => (sql.startsWith('SELECT t.*, b.parent_role') ? [{
    id: 7,
    judul: 'Tugas uji',
    created_by: 88,
    assigned_to: users.KABID.id,
    anggaran_dana: 100,
    bukti_kerja: '/uploads/bukti-lama.pdf'
  }] : []);
  const response = await request('/api/tasks/7/submit-review', 'KABID', {
    method: 'POST',
    body: JSON.stringify({ anggaran_terpakai: 0, pelaksana_ids: [12] })
  });

  assert.equal(response.status, 403);
  assert.equal(queryLog.some((entry) => entry.sql === 'BEGIN TRANSACTION'), false);
});

test('reviewer selain Super Admin tidak dapat mengubah pelaksana', async () => {
  queryHandler = (sql) => {
    if (sql.startsWith('SELECT t.*, creator.role AS creator_role')) {
      return [{
        id: 7,
        judul: 'Tugas uji',
        created_by: 88,
        assigned_to: 99,
        bidang_id: 1,
        status: 'UNDER_REVIEW',
        assignee_role: 'STAF'
      }];
    }
    if (sql.startsWith('SELECT parent_role FROM bidang')) return [{ parent_role: null }];
    return [];
  };
  const response = await request('/api/tasks/7/review', 'MUDIR', {
    method: 'POST',
    body: JSON.stringify({
      action: 'APPROVE',
      nilai_sop: 4,
      nilai_waktu: 4,
      nilai_kualitas: 5,
      pelaksana_ids: [12]
    })
  });

  assert.equal(response.status, 403);
  assert.equal(queryLog.some((entry) => entry.sql === 'BEGIN TRANSACTION'), false);
});

test('agregasi laporan mencantumkan seluruh pelaksana pilihan Super Admin', () => {
  const [row] = aggregateReportRows([{
    judul: 'Tugas multi pelaksana',
    periode: 'INSIDENTAL',
    kategori: 'MENDADAK',
    status: 'COMPLETED',
    pelaksana_names: ['Pengguna 11', 'Pengguna 12'],
    assignee_nama: 'Pengguna 11'
  }]);

  assert.equal(row.pelaksana, 'Pengguna 11\nPengguna 12');
});

test('Staf dapat membuat pekerjaan yang ditugaskan kepada dirinya sendiri', async () => {
  queryHandler = (sql) => {
    if (sql.startsWith('SELECT id, role, bidang_id FROM users WHERE id =')) {
      return [{ id: users.STAF.id, role: 'STAF', bidang_id: users.STAF.bidang_id }];
    }
    if (sql.startsWith('INSERT INTO tasks')) return { insertId: 73 };
    if (sql.startsWith('INSERT INTO notifications')) return { insertId: 91 };
    return [];
  };
  const response = await request('/api/tasks', 'STAF', {
    method: 'POST',
    body: JSON.stringify({
      judul: 'Pekerjaan pribadi',
      assigned_to: users.STAF.id,
      bidang_id: users.STAF.bidang_id,
      due_date: '2026-10-28T17:00',
      anggaran_dana: '0',
      is_recurring: '0'
    })
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  const insert = queryLog.find((entry) => entry.sql.startsWith('INSERT INTO tasks'));
  assert.equal(insert.params[5], users.STAF.id);
  assert.equal(insert.params[6], users.STAF.id);
  assert.equal(insert.params[7], users.STAF.bidang_id);
});

test('Staf tidak dapat membuat pekerjaan untuk pengguna lain', async () => {
  const response = await request('/api/tasks', 'STAF', {
    method: 'POST',
    body: JSON.stringify({
      judul: 'Penugasan tidak sah',
      assigned_to: 99,
      bidang_id: users.STAF.bidang_id,
      due_date: '2026-10-28T17:00',
      anggaran_dana: '0'
    })
  });

  assert.equal(response.status, 403);
  assert.equal(queryLog.some((entry) => entry.sql.startsWith('INSERT INTO tasks')), false);
});

test('Pengguna ditolak menghapus tugas yang ditugaskan kepadanya, termasuk Super Admin', async () => {
  queryHandler = (sql) => (sql.startsWith('SELECT created_by, assigned_to')
    ? [{ created_by: 99, assigned_to: users.SUPER_ADMIN.id }]
    : []);
  const response = await request('/api/tasks/73', 'SUPER_ADMIN', { method: 'DELETE' });

  assert.equal(response.status, 403);
  assert.equal(queryLog.some((entry) => entry.sql.startsWith('DELETE FROM tasks')), false);
});

test('Super Admin dapat menghapus tugas yang tidak ditugaskan kepadanya', async () => {
  queryHandler = (sql) => {
    if (sql.startsWith('SELECT created_by, assigned_to')) {
      return [{ created_by: 99, assigned_to: users.STAF.id }];
    }
    if (sql.startsWith('DELETE FROM tasks WHERE id =')) return { affectedRows: 1 };
    return [];
  };
  const response = await request('/api/tasks/73', 'SUPER_ADMIN', { method: 'DELETE' });

  assert.equal(response.status, 200);
  assert.ok(queryLog.some((entry) => entry.sql.startsWith('DELETE FROM tasks WHERE id =')));
});

test('Hapus massal menolak tugas yang ditugaskan kepada Super Admin', async () => {
  queryHandler = (sql) => {
    if (sql.startsWith('SELECT id, assigned_to')) {
      return [{ id: 73, assigned_to: users.SUPER_ADMIN.id }];
    }
    return [];
  };
  const response = await request('/api/tasks', 'SUPER_ADMIN', {
    method: 'DELETE',
    body: JSON.stringify({ ids: [73] })
  });

  assert.equal(response.status, 403);
  assert.equal(queryLog.some((entry) => entry.sql.startsWith('DELETE FROM tasks')), false);
});
