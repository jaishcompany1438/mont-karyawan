const { getPool, isDbConnected } = require('../config/db');
const { createNotification } = require('./notificationController');
const { getTodayRange } = require('../utils/dateRange');

function recurringFlag(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'ya', 'y', 'yes'].includes(String(value).toLowerCase()) ? 1 : 0;
}

function parseHolidayExclusions(value) {
  if (value === undefined || value === null || value === '') return [];
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      parsed = value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(parsed)) throw new Error('Pengecualian hari libur harus berupa array.');
  const allowedWeekdays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const values = parsed.map((item) => String(item).trim().toUpperCase()).filter(Boolean);
  if (values.some((item) => !allowedWeekdays.includes(item) && !/^\d{4}-\d{2}-\d{2}$/.test(item))) {
    throw new Error('Format pengecualian hari libur tidak valid.');
  }
  return [...new Set(values)];
}

function parseRating(value, label) {
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error(`${label} harus bernilai antara 1 sampai 5.`);
  }
  return Math.round(rating * 10) / 10;
}

function parseExecutorIds(value) {
  const values = Array.isArray(value) ? value : [value];
  if (!values.length || values.some((item) => item === undefined || item === null || String(item).trim() === '')) {
    throw new Error('Pilih setidaknya satu pelaksana tugas.');
  }

  const ids = [];
  for (const item of values) {
    const id = Number(item);
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new Error('Pilihan pelaksana tugas tidak valid.');
    }
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

async function resolveExecutorSelection(db, value) {
  const executorIds = value;
  const placeholders = executorIds.map(() => '?').join(', ');
  const [executorRows] = await db.query(
    `SELECT id, nama FROM users WHERE id IN (${placeholders})`,
    executorIds
  );
  if (executorRows.length !== executorIds.length) return null;
  const executorById = new Map(executorRows.map((executor) => [Number(executor.id), executor]));
  return {
    executorIds,
    executorNames: executorIds.map((executorId) => executorById.get(executorId).nama)
  };
}

const TASK_LIST_SELECT = `
  SELECT t.*,
         creator.nama AS creator_nama, creator.role AS creator_role,
         assignee.nama AS assignee_nama, assignee.role AS assignee_role, assignee.email AS assignee_email, assignee.no_telepon AS assignee_no_telepon, assignee.jabatan AS assignee_jabatan,
         assignee.sub_bidang AS assignee_sub_bidang,
         b.nama_bidang, b.kode_bidang, b.parent_role
  FROM tasks t
  JOIN users creator ON t.created_by = creator.id
  JOIN users assignee ON t.assigned_to = assignee.id
  JOIN bidang b ON t.bidang_id = b.id
  WHERE 1=1
`;

// Clause visibilitas tugas berdasarkan peran (alias tabel: t, b).
function buildTaskVisibility({ role, bidang_id, id: userId }) {
  if (role === 'STAF') {
    return { clause: ' AND t.assigned_to = ?', params: [userId] };
  }
  if (role === 'KABID') {
    return {
      clause: ' AND (t.bidang_id = ? OR t.created_by = ? OR t.assigned_to = ?)',
      params: [bidang_id, userId, userId]
    };
  }
  if (role === 'WADIR_PEND' || role === 'WADIR_PENGS') {
    return {
      clause: ' AND (b.parent_role = ? OR t.created_by = ? OR t.assigned_to = ?)',
      params: [role, userId, userId]
    };
  }
  // SUPER_ADMIN, MUDIR dan WAKIL_MUDIR dapat melihat semua tugas.
  return { clause: '', params: [] };
}

// GET /api/tasks/today
// Daftar tugas jatuh tempo hari ini (tanggal sistem) untuk dashboard utama. Terbuka untuk semua peran,
// tetapi visibilitas tetap dibatasi sesuai peran.
async function getTodayTasks(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: 'Database belum terhubung.' });
    }

    const { start, end } = getTodayRange();
    const visibility = buildTaskVisibility(req.user);
    const query = `${TASK_LIST_SELECT}
      AND t.due_date >= ? AND t.due_date < ?${visibility.clause}
      ORDER BY CASE WHEN t.status = 'COMPLETED' THEN 1 ELSE 0 END ASC,
               t.due_date ASC,
               FIELD(t.prioritas, 'URGEN', 'TINGGI', 'SEDANG', 'RENDAH') ASC,
               t.id ASC`;

    const [rows] = await getPool().query(query, [start, end, ...visibility.params]);
    return res.json({ success: true, count: rows.length, date: start.slice(0, 10), data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil tugas hari ini: ' + error.message });
  }
}

// GET /api/tasks (Manajemen Tugas; dibatasi peran di routes)
async function getTasks(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: 'Database belum terhubung.' });
    }

    const { periode, status, prioritas, kategori, bidang_id: filterBidangId, assigned_to, search } = req.query;
    const db = getPool();

    let query = TASK_LIST_SELECT;
    const params = [];

    // Keep the task-management view focused: current month plus the previous month.
    // Report endpoints intentionally do not use this default so historical exports remain available.
    const now = new Date();
    const displayStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const displayEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const toSqlDateTime = (date) => {
      const pad = (value) => String(value).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    };
    query += ' AND t.due_date >= ? AND t.due_date < ?';
    params.push(toSqlDateTime(displayStart), toSqlDateTime(displayEnd));

    const visibility = buildTaskVisibility(req.user);
    query += visibility.clause;
    params.push(...visibility.params);

    // Period filter (PRD 3.2: HARIAN, PEKANAN, BULANAN, TAHUNAN, INSIDENTAL)
    if (periode && ['HARIAN', 'PEKANAN', 'BULANAN', 'TAHUNAN', 'INSIDENTAL'].includes(periode.toUpperCase())) {
      query += ' AND t.periode = ?';
      params.push(periode.toUpperCase());
    }

    // Status filter (TO_DO, IN_PROGRESS, UNDER_REVIEW, COMPLETED, REVISION)
    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    // Priority filter
    if (prioritas) {
      query += ' AND t.prioritas = ?';
      params.push(prioritas);
    }

    // Kategori filter
    if (kategori) {
      query += ' AND t.kategori = ?';
      params.push(kategori);
    }

    // Department filter
    if (filterBidangId) {
      query += ' AND t.bidang_id = ?';
      params.push(filterBidangId);
    }

    // Assignee filter
    if (assigned_to) {
      query += ' AND t.assigned_to = ?';
      params.push(assigned_to);
    }

    // Keyword search
    if (search) {
      query += ' AND (t.judul LIKE ? OR t.deskripsi LIKE ? OR assignee.nama LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY t.due_date ASC, t.created_at DESC';

    const [rows] = await db.query(query, params);
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data tugas: ' + error.message });
  }
}

// GET /api/tasks/:id
async function getTaskById(req, res) {
  try {
    const { id } = req.params;
    const db = getPool();

    const [rows] = await db.query(
      `SELECT t.*,
              creator.nama AS creator_nama, creator.role AS creator_role,
              assignee.nama AS assignee_nama, assignee.role AS assignee_role, assignee.email AS assignee_email, assignee.no_telepon AS assignee_no_telepon, assignee.jabatan AS assignee_jabatan,
              assignee.sub_bidang AS assignee_sub_bidang,
              b.nama_bidang, b.kode_bidang, b.parent_role
       FROM tasks t
       JOIN users creator ON t.created_by = creator.id
       JOIN users assignee ON t.assigned_to = assignee.id
       JOIN bidang b ON t.bidang_id = b.id
       WHERE t.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });
    }

    const task = rows[0];
    const { role, bidang_id, id: userId } = req.user;

    // Check RBAC read permission
    if (role === 'STAF' && task.assigned_to !== userId) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki hak akses ke tugas ini.' });
    }
    if ((role === 'WADIR_PEND' || role === 'WADIR_PENGS') &&
        task.created_by !== userId && task.assigned_to !== userId && task.parent_role !== role) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki hak akses ke tugas di cabang ini.' });
    }
    if (role === 'KABID' && task.bidang_id !== bidang_id && task.created_by !== userId && task.assigned_to !== userId) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki hak akses ke tugas di bidang lain.' });
    }

    return res.json({ success: true, data: task });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil detail tugas: ' + error.message });
  }
}

// POST /api/tasks
async function createTask(req, res) {
  try {
    const { role, bidang_id: creatorBidangId, id: creatorId } = req.user;

    const {
      judul,
      deskripsi,
      periode = 'HARIAN',
      kategori = 'RUTIN',
      prioritas = 'SEDANG',
      assigned_to,
      bidang_id,
      due_date,
      is_recurring,
      anggaran_dana,
      libur_pengecualian
    } = req.body;
    if (!judul || !assigned_to || !due_date || anggaran_dana === undefined || anggaran_dana === null || anggaran_dana === '') {
      return res.status(400).json({
        success: false,
        message: 'Judul, penerima, tenggat, dan anggaran dana wajib diisi.'
      });
    }
    const budget = Number(anggaran_dana);
    if (!Number.isFinite(budget) || budget < 0) return res.status(400).json({ success: false, message: 'Anggaran dana harus berupa angka nol atau lebih.' });

    const requestedSelfAssignment = String(assigned_to) === String(creatorId);
    if (['STAF', 'WAKIL_MUDIR'].includes(role) && !requestedSelfAssignment) {
      return res.status(403).json({ success: false, message: 'Anda hanya dapat membuat pekerjaan untuk diri sendiri.' });
    }

    const db = getPool();
    let holidayExclusions;
    try {
      holidayExclusions = parseHolidayExclusions(libur_pengecualian);
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    // Verify assignee and RBAC hierarchy (PRD 3.4)
    const [assigneeRows] = await db.query('SELECT id, role, bidang_id FROM users WHERE id = ?', [assigned_to]);
    if (assigneeRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Penerima tugas tidak ditemukan.' });
    }

    const assignee = assigneeRows[0];
    const isSelfAssigned = String(assignee.id) === String(creatorId);

    if (role === 'KABID') {
      // Kabid may create their own work or assign work to staff in their own bidang.
      if (isSelfAssigned) {
        if (assignee.bidang_id !== creatorBidangId) {
          return res.status(403).json({ success: false, message: 'Kepala Bidang hanya dapat membuat pekerjaan sendiri di bidangnya.' });
        }
      } else if (assignee.role !== 'STAF' || assignee.bidang_id !== creatorBidangId) {
        return res.status(403).json({
          success: false,
          message: 'Kepala Bidang hanya boleh menugaskan tugas kepada Staf di dalam bidangnya sendiri.'
        });
      }
    } else if (role === 'WAKIL_MUDIR') {
      if (!isSelfAssigned) {
        return res.status(403).json({ success: false, message: 'Wakil Mudir hanya dapat membuat pekerjaan untuk dirinya sendiri.' });
      }
    } else if (role === 'STAF') {
      if (!isSelfAssigned) {
        return res.status(403).json({ success: false, message: 'Anda hanya dapat membuat pekerjaan untuk diri sendiri.' });
      }
    } else if (role === 'WADIR_PEND' || role === 'WADIR_PENGS') {
      let branchRows = [];
      if (!isSelfAssigned) {
        [branchRows] = await db.query('SELECT parent_role FROM bidang WHERE id = ?', [assignee.bidang_id]);
      }
      if (!isSelfAssigned && (!['KABID', 'STAF'].includes(assignee.role) || !branchRows[0] || branchRows[0].parent_role !== role)) {
        return res.status(403).json({ success: false, message: 'Wadir hanya dapat menugaskan kepada Kabid atau Staf di bawah cabangnya.' });
      }
    }
    // Mudir / Super Admin: bebas memilih siapa saja

    // Target bidang
    const targetBidangId = bidang_id || assignee.bidang_id || creatorBidangId;
    if (!targetBidangId) {
      return res.status(400).json({ success: false, message: 'Bidang penugasan harus ditentukan.' });
    }
    if (role === 'STAF' && String(targetBidangId) !== String(creatorBidangId)) {
      return res.status(403).json({ success: false, message: 'Pekerjaan Staf hanya dapat dibuat di bidangnya sendiri.' });
    }
    if (role === 'KABID' && isSelfAssigned && String(targetBidangId) !== String(creatorBidangId)) {
      return res.status(403).json({ success: false, message: 'Pekerjaan Kepala Bidang hanya dapat dibuat di bidangnya sendiri.' });
    }
    if (role === 'WADIR_PEND' || role === 'WADIR_PENGS') {
      const [targetBranch] = await db.query('SELECT parent_role FROM bidang WHERE id = ?', [targetBidangId]);
      if (!targetBranch[0] || targetBranch[0].parent_role !== role) {
        return res.status(403).json({ success: false, message: 'Bidang tugas harus berada di cabang Wadir.' });
      }
    }

    const file_attachment = req.file ? `/uploads/${req.file.filename}` : (req.body.file_attachment || null);

    const [result] = await db.query(
      `INSERT INTO tasks (
        judul, deskripsi, periode, kategori, prioritas, status,
        created_by, assigned_to, bidang_id, due_date, anggaran_dana, anggaran_terpakai, file_attachment, is_recurring, libur_pengecualian
      ) VALUES (?, ?, ?, ?, ?, 'TO_DO', ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        judul.trim(),
        deskripsi || null,
        periode,
        kategori,
        prioritas,
        creatorId,
        assignee.id,
        targetBidangId,
        new Date(due_date),
        budget,
        file_attachment,
        recurringFlag(
          is_recurring,
          ['HARIAN', 'PEKANAN', 'BULANAN'].includes(String(periode).toUpperCase()) ? 1 : 0
        ),
        JSON.stringify(holidayExclusions)
      ]
    );

    // Notify assignee
    await createNotification({
      userId: assignee.id,
      judul: `Tugas Baru: ${judul.trim()}`,
      pesan: `Anda menerima penugasan baru "${judul.trim()}" (Prioritas: ${prioritas}). Batas waktu: ${new Date(due_date).toLocaleDateString('id-ID')}.`,
      tipe: 'PERINTAH_ATASAN',
      referenceId: result.insertId,
      referenceType: 'tasks'
    });

    return res.status(201).json({
      success: true,
      message: 'Tugas berhasil dibuat.',
      data: { id: result.insertId }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal membuat tugas: ' + error.message });
  }
}

// PUT /api/tasks/:id
async function updateTask(req, res) {
  try {
    const { id } = req.params;
    const { role, id: userId, bidang_id: userBidangId } = req.user;
    const db = getPool();

    const [rows] = await db.query('SELECT t.*, b.parent_role FROM tasks t JOIN bidang b ON b.id = t.bidang_id WHERE t.id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });
    }
    const task = rows[0];

    // KABID uses the dedicated delegation endpoint and cannot edit task details.
    const canEdit =
      role === 'SUPER_ADMIN' ||
      role === 'MUDIR' ||
      (task.created_by === userId && role !== 'KABID');
    const wadirEdit = (role === 'WADIR_PEND' || role === 'WADIR_PENGS') && task.parent_role === role;

    if (!canEdit && !wadirEdit) {
      return res.status(403).json({ success: false, message: 'Anda tidak berhak mengedit detail tugas ini.' });
    }

    const {
      judul,
      deskripsi,
      periode,
      kategori,
      prioritas,
      status,
      assigned_to,
      bidang_id,
      due_date,
      is_recurring
      ,anggaran_dana,
      libur_pengecualian
    } = req.body;
    const nextBudget = Number(anggaran_dana !== undefined ? anggaran_dana : task.anggaran_dana);
    if (!Number.isFinite(nextBudget) || nextBudget < 0 || nextBudget < Number(task.anggaran_terpakai || 0)) {
      return res.status(400).json({ success: false, message: 'Anggaran dana tidak valid atau lebih kecil dari anggaran terpakai.' });
    }
    let holidayExclusions;
    try {
      holidayExclusions = parseHolidayExclusions(
        libur_pengecualian !== undefined ? libur_pengecualian : task.libur_pengecualian
      );
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (role === 'WADIR_PEND' || role === 'WADIR_PENGS') {
      const [candidate] = await db.query(
        `SELECT u.role, b.parent_role FROM users u LEFT JOIN bidang b ON u.bidang_id = b.id WHERE u.id = ?`,
        [assigned_to || task.assigned_to]
      );
      if (!candidate[0] || !['KABID', 'STAF'].includes(candidate[0].role) || candidate[0].parent_role !== role) {
        return res.status(403).json({ success: false, message: 'Wadir hanya dapat menugaskan ke Kabid atau Staf di bawah cabangnya.' });
      }
    }

    const file_attachment = req.file ? `/uploads/${req.file.filename}` : (req.body.file_attachment !== undefined ? req.body.file_attachment : task.file_attachment);

    await db.query(
      `UPDATE tasks SET
        judul = ?, deskripsi = ?, periode = ?, kategori = ?, prioritas = ?,
        status = ?, assigned_to = ?, bidang_id = ?, due_date = ?, anggaran_dana = ?, file_attachment = ?,
        is_recurring = ?, libur_pengecualian = ?, recurrence_generated_at = NULL
       WHERE id = ?`,
      [
        judul || task.judul,
        deskripsi !== undefined ? deskripsi : task.deskripsi,
        periode || task.periode,
        kategori || task.kategori,
        prioritas || task.prioritas,
        status || task.status,
        assigned_to || task.assigned_to,
        bidang_id || task.bidang_id,
        due_date ? new Date(due_date) : task.due_date,
        nextBudget,
        file_attachment,
        recurringFlag(is_recurring, task.is_recurring),
        JSON.stringify(holidayExclusions),
        id
      ]
    );

    return res.json({ success: true, message: 'Tugas berhasil diperbarui.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui tugas: ' + error.message });
  }
}

// PATCH /api/tasks/:id/delegate
// KABID may only delegate a task created by themselves to a STAF in their own bidang.
async function delegateTask(req, res) {
  try {
    const { id } = req.params;
    const { assigned_to: assignedTo } = req.body;
    const { id: userId, role, bidang_id: userBidangId } = req.user;

    if (role !== 'KABID') {
      return res.status(403).json({ success: false, message: 'Hanya KABID yang dapat menggunakan delegasi tugas ini.' });
    }
    if (!assignedTo) {
      return res.status(400).json({ success: false, message: 'Staf penerima delegasi wajib dipilih.' });
    }

    const db = getPool();
    const [tasks] = await db.query(
      'SELECT id, judul, created_by, assigned_to, bidang_id FROM tasks WHERE id = ? LIMIT 1',
      [id]
    );
    if (!tasks.length) {
      return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });
    }
    const task = tasks[0];
    if (task.bidang_id !== userBidangId || (task.created_by !== userId && task.assigned_to !== userId)) {
      return res.status(403).json({ success: false, message: 'KABID hanya dapat mendelegasikan tugas yang berada di bawah tanggung jawabnya.' });
    }

    const [staffRows] = await db.query(
      'SELECT id, nama, role, bidang_id FROM users WHERE id = ? LIMIT 1',
      [assignedTo]
    );
    const staff = staffRows[0];
    if (!staff || staff.role !== 'STAF' || staff.bidang_id !== userBidangId) {
      return res.status(403).json({ success: false, message: 'Delegasi hanya dapat diberikan kepada Staf di bidang KABID.' });
    }

    await db.query('UPDATE tasks SET assigned_to = ? WHERE id = ?', [staff.id, id]);
    await createNotification({
      userId: staff.id,
      judul: `Delegasi Tugas: ${task.judul}`,
      pesan: `${req.user.nama} mendelegasikan tugas "${task.judul}" kepada Anda.`,
      tipe: 'PERINTAH_ATASAN',
      referenceId: task.id,
      referenceType: 'tasks'
    });

    return res.json({ success: true, message: 'Tugas berhasil didelegasikan kepada Staf.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mendelegasikan tugas: ' + error.message });
  }
}

// PATCH /api/tasks/:id/status (e.g. TO_DO -> IN_PROGRESS)
async function updateTaskStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { id: userId, role } = req.user;

    const validStatuses = ['TO_DO', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'REVISION'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tidak valid.' });
    }

    const db = getPool();
    const [rows] = await db.query('SELECT t.*, b.parent_role FROM tasks t JOIN bidang b ON b.id = t.bidang_id WHERE t.id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });
    }
    const task = rows[0];

    // Assignee can transition TO_DO -> IN_PROGRESS
    if (role === 'STAF' && task.assigned_to !== userId) {
      return res.status(403).json({ success: false, message: 'Anda hanya dapat mengubah status tugas Anda sendiri.' });
    }

    if (status === 'IN_PROGRESS') {
      await db.query(
        `UPDATE tasks
         SET status = ?, started_by = COALESCE(started_by, ?), started_at = COALESCE(started_at, NOW())
         WHERE id = ?`,
        [status, userId, id]
      );
    } else if (status === 'COMPLETED') {
      await db.query(
        `UPDATE tasks
         SET status = ?, completed_by = ?, completed_at = NOW()
         WHERE id = ?`,
        [status, userId, id]
      );
    } else {
      await db.query('UPDATE tasks SET status = ? WHERE id = ?', [status, id]);
    }
    return res.json({ success: true, message: `Status tugas diperbarui menjadi ${status}.` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui status tugas: ' + error.message });
  }
}

// POST /api/tasks/:id/submit-review (Staf submits work evidence)
async function submitReview(req, res) {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;
    const {
      keterangan,
      kendala,
      solusi,
      anggaran_terpakai,
      pelaksana_id: singleExecutorId,
      pelaksana_ids: selectedExecutorIds
    } = req.body;

    const db = getPool();
    const [rows] = await db.query('SELECT t.*, b.parent_role FROM tasks t JOIN bidang b ON b.id = t.bidang_id WHERE t.id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });
    }
    const task = rows[0];

    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && (singleExecutorId !== undefined || selectedExecutorIds !== undefined)) {
      return res.status(403).json({ success: false, message: 'Hanya Super Admin yang dapat memilih pelaksana tugas.' });
    }

    let executorIds = [userId];
    let executorNames = [req.user.nama];
    if (isSuperAdmin) {
      let input;
      try {
        input = parseExecutorIds(selectedExecutorIds !== undefined
          ? selectedExecutorIds
          : (singleExecutorId !== undefined ? singleExecutorId : task.assigned_to));
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      const selection = await resolveExecutorSelection(db, input);
      if (!selection) {
        return res.status(400).json({ success: false, message: 'Satu atau beberapa pelaksana tugas tidak ditemukan.' });
      }
      executorIds = selection.executorIds;
      executorNames = selection.executorNames;
    }
    if (anggaran_terpakai === undefined || anggaran_terpakai === null || anggaran_terpakai === '') {
      return res.status(400).json({ success: false, message: 'Anggaran terpakai wajib diisi, termasuk dengan nilai 0.' });
    }
    const spent = Number(anggaran_terpakai);
    if (!Number.isFinite(spent) || spent < 0 || spent > Number(task.anggaran_dana)) {
      return res.status(400).json({ success: false, message: 'Anggaran terpakai harus 0 atau lebih dan tidak boleh melebihi anggaran dana.' });
    }

    if (task.assigned_to !== userId && req.user.role === 'STAF') {
      return res.status(403).json({ success: false, message: 'Hanya penerima tugas yang dapat mengirimkan bukti kerja.' });
    }

    let bukti_kerja = req.file ? `/uploads/${req.file.filename}` : null;
    if (!bukti_kerja && keterangan) {
      bukti_kerja = `Catatan: ${keterangan}`;
    }

    if (!bukti_kerja && !task.bukti_kerja) {
      return res.status(400).json({ success: false, message: 'Wajib mengunggah berkas bukti kerja atau memberikan keterangan.' });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `UPDATE tasks SET status = 'UNDER_REVIEW', anggaran_terpakai = ?, bukti_kerja = COALESCE(?, bukti_kerja),
         kendala = ?, solusi = ?, completed_by = ${isSuperAdmin ? '?' : 'COALESCE(completed_by, ?)'}, completed_at = COALESCE(completed_at, NOW())
         WHERE id = ?`,
        [spent, bukti_kerja, String(kendala || '').trim() || null, String(solusi || '').trim() || null, executorIds[0], id]
      );
      if (isSuperAdmin) {
        await connection.query('DELETE FROM task_executors WHERE task_id = ?', [id]);
        await connection.query(
          `INSERT INTO task_executors (task_id, user_id) VALUES ${executorIds.map(() => '(?, ?)').join(', ')}`,
          executorIds.flatMap((executorId) => [id, executorId])
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    // Notify task creator
    await createNotification({
      userId: task.created_by,
      judul: `Bukti Kerja Dikirim: ${task.judul}`,
      pesan: `${executorNames.join(', ')} tercatat sebagai pelaksana tugas "${task.judul}". Bukti kerja siap untuk diverifikasi.`,
      tipe: 'REVIEW_PEKERJAAN',
      referenceId: task.id,
      referenceType: 'tasks'
    });

    return res.json({ success: true, message: 'Tugas berhasil diajukan untuk review (UNDER_REVIEW).' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mengirimkan tugas untuk review: ' + error.message });
  }
}

// POST /api/tasks/:id/review (Approve or Reject by Creator / Supervisor)
async function reviewTask(req, res) {
  try {
    const { id } = req.params;
    const {
      action,
      catatan_revisi,
      nilai_sop,
      nilai_waktu,
      nilai_kualitas,
      catatan_reviewer,
      pelaksana_ids: selectedExecutorIds,
      pelaksana_id: singleExecutorId
    } = req.body; // action: 'APPROVE' or 'REJECT'
    const { id: userId, role, bidang_id: userBidangId } = req.user;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Aksi review harus APPROVE atau REJECT.' });
    }

    if (action === 'REJECT' && (!catatan_revisi || catatan_revisi.trim().length === 0)) {
      return res.status(400).json({ success: false, message: 'Catatan revisi wajib diisi jika tugas ditolak/revisi.' });
    }
    let ratings;
    try {
      ratings = {
        sop: parseRating(nilai_sop, 'Nilai SOP'),
        waktu: parseRating(nilai_waktu, 'Nilai waktu'),
        kualitas: parseRating(nilai_kualitas, 'Nilai kualitas')
      };
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    const db = getPool();
    const [rows] = await db.query(
      `SELECT t.*, creator.role AS creator_role, assignee.role AS assignee_role
       FROM tasks t
       JOIN users creator ON creator.id = t.created_by
       JOIN users assignee ON assignee.id = t.assigned_to
       WHERE t.id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });
    }
    const task = rows[0];

    // A KABID reviews work of staff (subordinates) in their own bidang, whoever created the task.
    // Senior leadership reviews subordinate work.
    const [taskWithBranch] = await db.query('SELECT parent_role FROM bidang WHERE id = ?', [task.bidang_id]);
    task.parent_role = taskWithBranch[0] && taskWithBranch[0].parent_role;
    const canReview =
      role === 'SUPER_ADMIN' ||
      ['MUDIR', 'WAKIL_MUDIR'].includes(role) ||
      (role === 'KABID' &&
        task.bidang_id === userBidangId &&
        task.assignee_role === 'STAF') ||
      ((role === 'WADIR_PEND' || role === 'WADIR_PENGS') && task.parent_role === role);

    if (!canReview) {
      return res.status(403).json({
        success: false,
        message: 'Hanya pembuat tugas atau pimpinan yang berhak menyetujui / menolak hasil pekerjaan.'
      });
    }

    const hasExecutorSelection = selectedExecutorIds !== undefined || singleExecutorId !== undefined;
    if (hasExecutorSelection && role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Hanya Super Admin yang dapat memilih pelaksana tugas.' });
    }
    if (hasExecutorSelection && action !== 'APPROVE') {
      return res.status(400).json({ success: false, message: 'Pelaksana hanya dapat ditentukan saat menyetujui hasil tugas.' });
    }

    let executorSelection = null;
    if (hasExecutorSelection) {
      let executorIds;
      try {
        executorIds = parseExecutorIds(selectedExecutorIds !== undefined ? selectedExecutorIds : singleExecutorId);
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      executorSelection = await resolveExecutorSelection(db, executorIds);
      if (!executorSelection) {
        return res.status(400).json({ success: false, message: 'Satu atau beberapa pelaksana tugas tidak ditemukan.' });
      }
    }

    const newStatus = action === 'APPROVE' ? 'COMPLETED' : 'REVISION';
    const notes = action === 'REJECT' ? catatan_revisi.trim() : null;

    const reviewParams = [
      newStatus,
      notes,
      catatan_reviewer && catatan_reviewer.trim() ? catatan_reviewer.trim() : null,
      ratings.sop,
      ratings.waktu,
      ratings.kualitas
    ];
    if (executorSelection) {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          `UPDATE tasks SET status = ?, catatan_revisi = ?, catatan_reviewer = ?, nilai_sop = ?, nilai_waktu = ?, nilai_kualitas = ?,
           completed_by = CASE WHEN ? = 'COMPLETED' THEN ? ELSE completed_by END,
           completed_at = CASE WHEN ? = 'COMPLETED' THEN NOW() ELSE completed_at END
           WHERE id = ?`,
          [...reviewParams, newStatus, executorSelection.executorIds[0], newStatus, id]
        );
        await connection.query('DELETE FROM task_executors WHERE task_id = ?', [id]);
        await connection.query(
          `INSERT INTO task_executors (task_id, user_id) VALUES ${executorSelection.executorIds.map(() => '(?, ?)').join(', ')}`,
          executorSelection.executorIds.flatMap((executorId) => [id, executorId])
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } else {
      await db.query(
        `UPDATE tasks SET status = ?, catatan_revisi = ?, catatan_reviewer = ?, nilai_sop = ?, nilai_waktu = ?, nilai_kualitas = ?,
         completed_by = CASE WHEN ? = 'COMPLETED' THEN COALESCE(completed_by, ?) ELSE completed_by END,
         completed_at = CASE WHEN ? = 'COMPLETED' THEN NOW() ELSE completed_at END
         WHERE id = ?`,
        [...reviewParams, newStatus, userId, newStatus, id]
      );
    }

    // Notify assignee
    await createNotification({
      userId: task.assigned_to,
      judul: action === 'APPROVE' ? `Tugas Disetujui: ${task.judul}` : `Perlu Revisi: ${task.judul}`,
      pesan: action === 'APPROVE'
        ? `Alhamdulillah! Tugas "${task.judul}" telah disetujui dan dinyatakan selesai.`
        : `Tugas "${task.judul}" memerlukan revisi. Catatan: ${notes}`,
      tipe: action === 'APPROVE' ? 'INFO' : 'REVISI_PEKERJAAN',
      referenceId: task.id,
      referenceType: 'tasks'
    });

    return res.json({
      success: true,
      message: action === 'APPROVE'
        ? 'Tugas berhasil disetujui dan ditandai selesai (COMPLETED).'
        : 'Tugas dikembalikan untuk perbaikan (REVISION) beserta catatan revisi.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memproses review tugas: ' + error.message });
  }
}

// DELETE /api/tasks/:id
async function deleteTask(req, res) {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;
    const db = getPool();

    const [rows] = await db.query('SELECT created_by, assigned_to FROM tasks WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });
    }

    if (String(rows[0].assigned_to) === String(userId)) {
      return res.status(403).json({ success: false, message: 'Anda tidak dapat menghapus pekerjaan yang ditugaskan kepada Anda.' });
    }

    if (role === 'KABID' || (role !== 'SUPER_ADMIN' && role !== 'MUDIR' && rows[0].created_by !== userId)) {
      return res.status(403).json({ success: false, message: 'Anda tidak berhak menghapus tugas ini.' });
    }

    await db.query('DELETE FROM tasks WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Tugas berhasil dihapus.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus tugas: ' + error.message });
  }
}

// DELETE /api/tasks (bulk delete; Super Admin only)
async function deleteTasks(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Pilih minimal satu program kerja.' });
    }
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Hanya Super Admin yang dapat menghapus banyak program kerja.' });
    }

    const normalizedIds = ids.map(Number).filter(Number.isInteger);
    if (normalizedIds.length !== ids.length) {
      return res.status(400).json({ success: false, message: 'Daftar ID program kerja tidak valid.' });
    }

    const placeholders = normalizedIds.map(() => '?').join(',');
    const db = getPool();
    const [assignedTasks] = await db.query(
      `SELECT id, assigned_to FROM tasks WHERE id IN (${placeholders})`,
      normalizedIds
    );
    if (assignedTasks.some((task) => String(task.assigned_to) === String(req.user.id))) {
      return res.status(403).json({ success: false, message: 'Anda tidak dapat menghapus pekerjaan yang ditugaskan kepada Anda.' });
    }

    const [result] = await db.query(
      `DELETE FROM tasks WHERE id IN (${placeholders})`,
      normalizedIds
    );
    return res.json({ success: true, message: `${result.affectedRows} program kerja berhasil dihapus.` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus program kerja: ' + error.message });
  }
}

module.exports = {
  getTasks,
  getTodayTasks,
  buildTaskVisibility,
  parseExecutorIds,
  getTaskById,
  createTask,
  updateTask,
  delegateTask,
  updateTaskStatus,
  submitReview,
  reviewTask,
  deleteTask,
  deleteTasks,
  parseHolidayExclusions
};
