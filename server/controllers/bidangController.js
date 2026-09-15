const { getPool, isDbConnected } = require('../config/db');

async function getAllBidang(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: 'Database belum terhubung.' });
    }

    const db = getPool();
    const branchRole = ['WADIR_PEND', 'WADIR_PENGS'].includes(req.user.role)
      ? req.user.role
      : (req.user.role === 'WAKIL_MUDIR' && ['WADIR_PEND', 'WADIR_PENGS'].includes(req.user.parent_role)
        ? req.user.parent_role
        : null);
    let query = `
      SELECT b.*,
             (SELECT COUNT(*) FROM users u WHERE u.bidang_id = b.id) AS total_karyawan,
             (SELECT COUNT(*) FROM tasks t WHERE t.bidang_id = b.id AND t.status != 'COMPLETED') AS active_tasks
      FROM bidang b
      WHERE 1=1
    `;
    const params = [];
    if (branchRole) {
      query += ' AND b.parent_role = ?';
      params.push(branchRole);
    } else if (['KABID', 'STAF'].includes(req.user.role)) {
      query += ' AND b.id = ?';
      params.push(req.user.bidang_id || 0);
    }
    query += ' ORDER BY b.nama_bidang ASC';
    const [rows] = await db.query(query, params);

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data bidang: ' + error.message });
  }
}

async function createBidang(req, res) {
  try {
    const { nama_bidang, kode_bidang, deskripsi, parent_role } = req.body;
    if (!nama_bidang || !kode_bidang) {
      return res.status(400).json({ success: false, message: 'Nama bidang dan kode bidang wajib diisi.' });
    }

    const db = getPool();
    // Check code uniqueness
    const [existing] = await db.query('SELECT id FROM bidang WHERE kode_bidang = ?', [kode_bidang.trim().toUpperCase()]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: `Kode bidang "${kode_bidang}" sudah digunakan.` });
    }

    const [result] = await db.query(
      'INSERT INTO bidang (nama_bidang, kode_bidang, deskripsi, parent_role) VALUES (?, ?, ?, ?)',
      [nama_bidang.trim(), kode_bidang.trim().toUpperCase(), deskripsi || null, ['WADIR_PEND', 'WADIR_PENGS'].includes(parent_role) ? parent_role : null]
    );

    return res.status(201).json({
      success: true,
      message: 'Bidang berhasil ditambahkan.',
      data: { id: result.insertId, nama_bidang, kode_bidang: kode_bidang.toUpperCase(), deskripsi, parent_role }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal menambahkan bidang: ' + error.message });
  }
}

async function updateBidang(req, res) {
  try {
    const { id } = req.params;
    const { nama_bidang, kode_bidang, deskripsi, parent_role } = req.body;

    if (!nama_bidang || !kode_bidang) {
      return res.status(400).json({ success: false, message: 'Nama bidang dan kode bidang wajib diisi.' });
    }

    const db = getPool();
    // Check uniqueness excluding current
    const [existing] = await db.query('SELECT id FROM bidang WHERE kode_bidang = ? AND id != ?', [
      kode_bidang.trim().toUpperCase(),
      id
    ]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: `Kode bidang "${kode_bidang}" sudah digunakan oleh bidang lain.` });
    }

    await db.query(
      'UPDATE bidang SET nama_bidang = ?, kode_bidang = ?, deskripsi = ?, parent_role = ? WHERE id = ?',
      [nama_bidang.trim(), kode_bidang.trim().toUpperCase(), deskripsi || null, ['WADIR_PEND', 'WADIR_PENGS'].includes(parent_role) ? parent_role : null, id]
    );

    return res.json({ success: true, message: 'Bidang berhasil diperbarui.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui bidang: ' + error.message });
  }
}

async function deleteBidang(req, res) {
  try {
    const { id } = req.params;
    const db = getPool();

    // Check if there are tasks linked
    const [tasks] = await db.query('SELECT id FROM tasks WHERE bidang_id = ? LIMIT 1', [id]);
    if (tasks.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Bidang tidak dapat dihapus karena masih memiliki riwayat tugas terkait.'
      });
    }

    await db.query('DELETE FROM bidang WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Bidang berhasil dihapus.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus bidang: ' + error.message });
  }
}

module.exports = {
  getAllBidang,
  createBidang,
  updateBidang,
  deleteBidang
};
