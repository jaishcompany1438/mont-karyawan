const { getPool, isDbConnected } = require('../config/db');

function recurringFlag(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'ya', 'y', 'yes'].includes(String(value).toLowerCase()) ? 1 : 0;
}

// GET /api/tasks
async function getTasks(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: 'Database belum terhubung.' });
    }

    const { role, bidang_id, id: userId } = req.user;
    const { periode, status, prioritas, kategori, bidang_id: filterBidangId, assigned_to, search } = req.query;
    const db = getPool();

    let query = `
      SELECT t.*,
             creator.nama AS creator_nama, creator.role AS creator_role,
             assignee.nama AS assignee_nama, assignee.email AS assignee_email, assignee.no_telepon AS assignee_no_telepon, assignee.jabatan AS assignee_jabatan,
             assignee.sub_bidang AS assignee_sub_bidang,
             b.nama_bidang, b.kode_bidang, b.parent_role
      FROM tasks t
      JOIN users creator ON t.created_by = creator.id
      JOIN users assignee ON t.assigned_to = assignee.id
      JOIN bidang b ON t.bidang_id = b.id
      WHERE 1=1
    `;
    const params = [];

    // RBAC filtering on visibility
    if (role === 'STAF') {
      // Staf only sees tasks assigned to them
      query += ' AND t.assigned_to = ?';
      params.push(userId);
    } else if (role === 'KABID') {
      // Kabid sees tasks in their bidang OR created by them OR assigned to them
      query += ' AND (t.bidang_id = ? OR t.created_by = ? OR t.assigned_to = ?)';
      params.push(bidang_id, userId, userId);
    } else if (role === 'WADIR_PEND' || role === 'WADIR_PENGS') {
      query += ' AND (b.parent_role = ? OR t.created_by = ? OR t.assigned_to = ?)';
      params.push(role, userId, userId);
    } else if (role === 'WAKIL_MUDIR') {
      query += ' AND (t.created_by = ? OR t.assigned_to = ?)';
      params.push(userId, userId);
    }
    // SUPER_ADMIN, MUDIR and legacy WAKIL_MUDIR can view all tasks.

    // Period filter (PRD 3.2: HARIAN, PEKANAN, BULANAN, TAHUNAN)
    if (periode && ['HARIAN', 'PEKANAN', 'BULANAN', 'TAHUNAN'].includes(periode.toUpperCase())) {
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
              assignee.nama AS assignee_nama, assignee.email AS assignee_email, assignee.no_telepon AS assignee_no_telepon, assignee.jabatan AS assignee_jabatan,
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
    if (role === 'WAKIL_MUDIR' && task.created_by !== userId && task.assigned_to !== userId) {
      return res.status(403).json({ success: false, message: 'Role Wakil Mudir lama tidak memiliki akses lintas cabang.' });
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

    if (role === 'STAF') {
      return res.status(403).json({ success: false, message: 'Staf tidak memiliki izin untuk membuat tugas.' });
    }

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
      anggaran_dana
    } = req.body;
    if (!judul || !assigned_to || !due_date || anggaran_dana === undefined || anggaran_dana === null || anggaran_dana === '') {
      return res.status(400).json({
        success: false,
        message: 'Judul, penerima, tenggat, dan anggaran dana wajib diisi.'
      });
    }
    const budget = Number(anggaran_dana);
    if (!Number.isFinite(budget) || budget < 0) return res.status(400).json({ success: false, message: 'Anggaran dana harus berupa angka nol atau lebih.' });

    const db = getPool();

    // Verify assignee and RBAC hierarchy (PRD 3.4)
    const [assigneeRows] = await db.query('SELECT id, role, bidang_id FROM users WHERE id = ?', [assigned_to]);
    if (assigneeRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Penerima tugas tidak ditemukan.' });
    }

    const assignee = assigneeRows[0];

    if (role === 'KABID') {
      // Kabid -> Hanya boleh memilih Staf di bidangnya
      if (assignee.role !== 'STAF' || assignee.bidang_id !== creatorBidangId) {
        return res.status(403).json({
          success: false,
          message: 'Kepala Bidang hanya boleh menugaskan tugas kepada Staf di dalam bidangnya sendiri.'
        });
      }
    } else if (role === 'WAKIL_MUDIR') {
      return res.status(403).json({ success: false, message: 'Role Wakil Mudir lama tidak memiliki cabang. Gunakan WADIR_PEND atau WADIR_PENGS.' });
    } else if (role === 'WADIR_PEND' || role === 'WADIR_PENGS') {
      const [branchRows] = await db.query('SELECT parent_role FROM bidang WHERE id = ?', [assignee.bidang_id]);
      if (assignee.role !== 'KABID' || !branchRows[0] || branchRows[0].parent_role !== role) {
        return res.status(403).json({ success: false, message: 'Wadir hanya dapat menugaskan kepada Kabid di bawah cabangnya.' });
      }
    }
    // Mudir / Super Admin: bebas memilih siapa saja

    // Target bidang
    const targetBidangId = bidang_id || assignee.bidang_id || creatorBidangId;
    if (!targetBidangId) {
      return res.status(400).json({ success: false, message: 'Bidang penugasan harus ditentukan.' });
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
        created_by, assigned_to, bidang_id, due_date, anggaran_dana, anggaran_terpakai, file_attachment, is_recurring
      ) VALUES (?, ?, ?, ?, ?, 'TO_DO', ?, ?, ?, ?, ?, 0, ?, ?)`,
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
        )
      ]
    );

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

    // Check edit permission: creator, super_admin, mudir, or kabid of that bidang
    const canEdit =
      role === 'SUPER_ADMIN' ||
      role === 'MUDIR' ||
      task.created_by === userId ||
      (role === 'KABID' && task.bidang_id === userBidangId);
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
      ,anggaran_dana
    } = req.body;
    const nextBudget = Number(anggaran_dana !== undefined ? anggaran_dana : task.anggaran_dana);
    if (!Number.isFinite(nextBudget) || nextBudget < 0 || nextBudget < Number(task.anggaran_terpakai || 0)) {
      return res.status(400).json({ success: false, message: 'Anggaran dana tidak valid atau lebih kecil dari anggaran terpakai.' });
    }
    if (role === 'WADIR_PEND' || role === 'WADIR_PENGS') {
      const [candidate] = await db.query(
        `SELECT u.role, b.parent_role FROM users u LEFT JOIN bidang b ON u.bidang_id = b.id WHERE u.id = ?`,
        [assigned_to || task.assigned_to]
      );
      if (!candidate[0] || candidate[0].role !== 'KABID' || candidate[0].parent_role !== role) {
        return res.status(403).json({ success: false, message: 'Wadir hanya dapat menugaskan ke Kabid di bawah cabangnya.' });
      }
    }

    const file_attachment = req.file ? `/uploads/${req.file.filename}` : (req.body.file_attachment !== undefined ? req.body.file_attachment : task.file_attachment);

    await db.query(
      `UPDATE tasks SET
        judul = ?, deskripsi = ?, periode = ?, kategori = ?, prioritas = ?,
        status = ?, assigned_to = ?, bidang_id = ?, due_date = ?, anggaran_dana = ?, file_attachment = ?,
        is_recurring = ?, recurrence_generated_at = NULL
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
        id
      ]
    );

    return res.json({ success: true, message: 'Tugas berhasil diperbarui.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui tugas: ' + error.message });
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

    await db.query('UPDATE tasks SET status = ? WHERE id = ?', [status, id]);
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
    const { keterangan, anggaran_terpakai } = req.body;

    const db = getPool();
    const [rows] = await db.query('SELECT t.*, b.parent_role FROM tasks t JOIN bidang b ON b.id = t.bidang_id WHERE t.id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });
    }
    const task = rows[0];
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

    await db.query(
      `UPDATE tasks SET status = 'UNDER_REVIEW', anggaran_terpakai = ?, bukti_kerja = COALESCE(?, bukti_kerja) WHERE id = ?`,
      [spent, bukti_kerja, id]
    );

    return res.json({ success: true, message: 'Tugas berhasil diajukan untuk review (UNDER_REVIEW).' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mengirimkan tugas untuk review: ' + error.message });
  }
}

// POST /api/tasks/:id/review (Approve or Reject by Creator / Supervisor)
async function reviewTask(req, res) {
  try {
    const { id } = req.params;
    const { action, catatan_revisi } = req.body; // action: 'APPROVE' or 'REJECT'
    const { id: userId, role, bidang_id: userBidangId } = req.user;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Aksi review harus APPROVE atau REJECT.' });
    }

    if (action === 'REJECT' && (!catatan_revisi || catatan_revisi.trim().length === 0)) {
      return res.status(400).json({ success: false, message: 'Catatan revisi wajib diisi jika tugas ditolak/revisi.' });
    }

    const db = getPool();
    const [rows] = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });
    }
    const task = rows[0];

    // Authorization: Super Admin, Mudir, Wakil Mudir, task creator, or Kabid of the department
    const [taskWithBranch] = await db.query('SELECT parent_role FROM bidang WHERE id = ?', [task.bidang_id]);
    task.parent_role = taskWithBranch[0] && taskWithBranch[0].parent_role;
    const canReview =
      role === 'SUPER_ADMIN' ||
      role === 'MUDIR' ||
      task.created_by === userId ||
      (role === 'KABID' && task.bidang_id === userBidangId) ||
      ((role === 'WADIR_PEND' || role === 'WADIR_PENGS') && task.parent_role === role);

    if (!canReview) {
      return res.status(403).json({
        success: false,
        message: 'Hanya pembuat tugas atau pimpinan yang berhak menyetujui / menolak hasil pekerjaan.'
      });
    }

    const newStatus = action === 'APPROVE' ? 'COMPLETED' : 'REVISION';
    const notes = action === 'REJECT' ? catatan_revisi.trim() : null;

    await db.query(
      `UPDATE tasks SET status = ?, catatan_revisi = ? WHERE id = ?`,
      [newStatus, notes, id]
    );

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

    const [rows] = await db.query('SELECT created_by FROM tasks WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan.' });
    }

    async function deleteTasks(req, res) {
      try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'Pilih minimal satu program kerja.' });
        if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ success: false, message: 'Hanya Super Admin yang dapat menghapus banyak program kerja.' });
        const normalizedIds = ids.map(Number).filter(Number.isInteger);
        if (normalizedIds.length !== ids.length) return res.status(400).json({ success: false, message: 'Daftar ID program kerja tidak valid.' });
        const db = getPool();
        const placeholders = normalizedIds.map(() => '?').join(',');
        const [result] = await db.query(`DELETE FROM tasks WHERE id IN (${placeholders})`, normalizedIds);
        return res.json({ success: true, message: `${result.affectedRows} program kerja berhasil dihapus.` });
      } catch (error) {
        return res.status(500).json({ success: false, message: 'Gagal menghapus program kerja: ' + error.message });
      }
    }

    if (role !== 'SUPER_ADMIN' && role !== 'MUDIR' && rows[0].created_by !== userId) {
      return res.status(403).json({ success: false, message: 'Anda tidak berhak menghapus tugas ini.' });
    }

    await db.query('DELETE FROM tasks WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Tugas berhasil dihapus.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus tugas: ' + error.message });
  }
}

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  submitReview,
  reviewTask,
  deleteTask,
  deleteTasks
};
