const bcrypt = require('bcryptjs');
const { getPool, isDbConnected } = require('../config/db');

async function getAllUsers(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: 'Database belum terhubung.' });
    }

    const { role, bidang_id, search } = req.query;
    const db = getPool();

    let query = `
      SELECT u.id, u.nama, u.email, u.role, u.bidang_id, u.jabatan, u.created_at,
             b.nama_bidang, b.kode_bidang
      FROM users u
      LEFT JOIN bidang b ON u.bidang_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (role) {
      query += ' AND u.role = ?';
      params.push(role);
    }
    if (bidang_id) {
      query += ' AND u.bidang_id = ?';
      params.push(bidang_id);
    }
    if (search) {
      query += ' AND (u.nama LIKE ? OR u.email LIKE ? OR u.jabatan LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY u.nama ASC';
    const [rows] = await db.query(query, params);

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data pengguna: ' + error.message });
  }
}

// Get allowed assignees based on current user's role hierarchy (PRD 3.4)
async function getAssignees(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: 'Database belum terhubung.' });
    }

    const { role, bidang_id, id } = req.user;
    const db = getPool();

    let query = `
      SELECT u.id, u.nama, u.email, u.role, u.bidang_id, u.jabatan,
             b.nama_bidang, b.kode_bidang
      FROM users u
      LEFT JOIN bidang b ON u.bidang_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (role === 'SUPER_ADMIN' || role === 'MUDIR') {
      // Mudir / Super Admin boleh memilih SIAPA SAJA
      query += ' AND u.id != ?';
      params.push(id);
    } else if (role === 'WAKIL_MUDIR') {
      // Wakil Mudir -> Boleh memilih Kabid atau Staf
      query += ' AND u.role IN (\'KABID\', \'STAF\')';
    } else if (role === 'KABID') {
      // Kabid -> Hanya boleh memilih Staf di bidangnya
      query += ' AND u.role = \'STAF\' AND u.bidang_id = ?';
      params.push(bidang_id);
    } else {
      // Staf tidak berhak memberikan tugas
      return res.json({ success: true, data: [] });
    }

    query += ' ORDER BY u.nama ASC';
    const [rows] = await db.query(query, params);

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data penerima tugas: ' + error.message });
  }
}

async function createUser(req, res) {
  try {
    const { nama, email, password, role, bidang_id, jabatan } = req.body;
    if (!nama || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Nama, email, password, dan role wajib diisi.' });
    }

    const validRoles = ['SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR', 'KABID', 'STAF'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Role tidak valid.' });
    }

    const db = getPool();
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: `Email "${email}" sudah terdaftar.` });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [result] = await db.query(
      `INSERT INTO users (nama, email, password, role, bidang_id, jabatan)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nama.trim(), email.trim().toLowerCase(), hashedPassword, role, bidang_id || null, jabatan || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Pengguna berhasil ditambahkan.',
      data: { id: result.insertId, nama, email, role, bidang_id, jabatan }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal menambahkan pengguna: ' + error.message });
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { nama, email, password, role, bidang_id, jabatan } = req.body;

    if (!nama || !email || !role) {
      return res.status(400).json({ success: false, message: 'Nama, email, dan role wajib diisi.' });
    }

    const db = getPool();
    const [existing] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [
      email.trim().toLowerCase(),
      id
    ]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: `Email "${email}" sudah digunakan oleh pengguna lain.` });
    }

    if (password && password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await db.query(
        `UPDATE users SET nama = ?, email = ?, password = ?, role = ?, bidang_id = ?, jabatan = ? WHERE id = ?`,
        [nama.trim(), email.trim().toLowerCase(), hashedPassword, role, bidang_id || null, jabatan || null, id]
      );
    } else {
      await db.query(
        `UPDATE users SET nama = ?, email = ?, role = ?, bidang_id = ?, jabatan = ? WHERE id = ?`,
        [nama.trim(), email.trim().toLowerCase(), role, bidang_id || null, jabatan || null, id]
      );
    }

    return res.json({ success: true, message: 'Pengguna berhasil diperbarui.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui pengguna: ' + error.message });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    // Prevent deleting self
    if (parseInt(id, 10) === req.user.id) {
      return res.status(400).json({ success: false, message: 'Anda tidak dapat menghapus akun Anda sendiri.' });
    }

    const db = getPool();
    const [tasks] = await db.query(
      'SELECT id FROM tasks WHERE created_by = ? OR assigned_to = ? LIMIT 1',
      [id, id]
    );
    if (tasks.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Pengguna tidak dapat dihapus karena memiliki riwayat tugas yang dibuat atau ditugaskan kepadanya.'
      });
    }

    await db.query('DELETE FROM users WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Pengguna berhasil dihapus.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus pengguna: ' + error.message });
  }
}

module.exports = {
  getAllUsers,
  getAssignees,
  createUser,
  updateUser,
  deleteUser
};
