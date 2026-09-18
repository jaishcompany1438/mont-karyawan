const fs = require('fs');
const { getPool, isDbConnected } = require('../config/db');

const COLORS = ['MERAH', 'ORANYE', 'HIJAU'];
const LEADERSHIP_ROLES = ['MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS', 'KABID'];

function getPatrolScope(user, alias = 'p') {
  if (user.role === 'SUPER_ADMIN' || user.role === 'MUDIR') return { clause: '1=1', params: [] };
  if (user.role === 'WADIR_PEND' || user.role === 'WADIR_PENGS') {
    return {
      clause: `(u.id = ? OR b.parent_role = ?)`,
      params: [user.id, user.role]
    };
  }
  if (user.role === 'KABID') {
    return { clause: `(u.id = ? OR u.bidang_id = ?)`, params: [user.id, user.bidang_id] };
  }
  return { clause: 'p.user_id = ?', params: [user.id] };
}

function normalizeScore(value, field) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 5) {
    throw new Error(`${field} harus berada di antara 0 sampai 5.`);
  }
  return Math.round(score * 10) / 10;
}

function normalizeColor(value, field) {
  const color = String(value || '').trim().toUpperCase();
  if (!COLORS.includes(color)) throw new Error(`${field} harus MERAH, ORANYE, atau HIJAU.`);
  return color;
}

function canAccessPatrol(user) {
  return user.role === 'SUPER_ADMIN' || LEADERSHIP_ROLES.includes(user.role) || Boolean(user.can_patroli);
}

function canCreatePatrol(user) {
  return canAccessPatrol(user);
}

async function getRooms(req, res) {
  try {
    const [rows] = await getPool().query(
      'SELECT id, nama_ruangan FROM patroli_ruangan WHERE is_active = 1 ORDER BY nama_ruangan ASC'
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: `Gagal mengambil area patroli: ${error.message}` });
  }
}

async function createRoom(req, res) {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ success: false, message: 'Hanya Super Admin yang dapat mengelola area.' });
    const name = String(req.body.nama_ruangan || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Nama area wajib diisi.' });
    const [result] = await getPool().query('INSERT INTO patroli_ruangan (nama_ruangan) VALUES (?)', [name]);
    return res.status(201).json({ success: true, data: { id: result.insertId, nama_ruangan: name } });
  } catch (error) {
    const status = error.code === 'ER_DUP_ENTRY' ? 409 : 500;
    return res.status(status).json({ success: false, message: status === 409 ? 'Area tersebut sudah ada.' : `Gagal menambah area: ${error.message}` });
  }
}

async function createPatrol(req, res) {
  let uploadedPath = null;
  let uploadedFilePath = null;
  try {
    if (!canCreatePatrol(req.user)) return res.status(403).json({ success: false, message: 'Anda tidak memiliki hak melakukan patroli.' });
    const {
      ruangan, tanggal, nilai_kebersihan, nilai_kerapihan, nilai_sarpras, nilai_ketertiban,
      skor_kebersihan, skor_kerapihan, skor_sarpras, skor_ketertiban, catatan_temuan
    } = req.body;
    if (!ruangan || !tanggal) return res.status(400).json({ success: false, message: 'Area dan tanggal wajib diisi.' });

    const colors = {
      kebersihan: normalizeColor(nilai_kebersihan, 'Nilai kebersihan'),
      kerapihan: normalizeColor(nilai_kerapihan, 'Nilai kerapihan'),
      sarpras: normalizeColor(nilai_sarpras, 'Nilai sarpras'),
      ketertiban: normalizeColor(nilai_ketertiban, 'Nilai ketertiban')
    };
    const scores = {
      kebersihan: normalizeScore(skor_kebersihan, 'Skor kebersihan'),
      kerapihan: normalizeScore(skor_kerapihan, 'Skor kerapihan'),
      sarpras: normalizeScore(skor_sarpras, 'Skor sarpras'),
      ketertiban: normalizeScore(skor_ketertiban, 'Skor ketertiban')
    };
    const note = String(catatan_temuan || '').trim();
    if (Object.values(colors).includes('MERAH') && !note) {
      return res.status(400).json({ success: false, message: 'Catatan temuan wajib diisi jika ada penilaian MERAH.' });
    }
    const [roomRows] = await getPool().query('SELECT id FROM patroli_ruangan WHERE nama_ruangan = ? AND is_active = 1', [String(ruangan).trim()]);
    if (!roomRows.length) return res.status(400).json({ success: false, message: 'Area patroli tidak terdaftar.' });
    if (req.file && !String(req.file.mimetype || '').startsWith('image/')) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, message: 'Foto bukti harus berupa file gambar.' });
    }
    uploadedFilePath = req.file ? req.file.path : null;
    uploadedPath = req.file ? `/uploads/${req.file.filename}` : null;
    const [result] = await getPool().query(
      `INSERT INTO patroli (
        user_id, ruangan, tanggal, nilai_kebersihan, nilai_kerapihan, nilai_sarpras, nilai_ketertiban,
        skor_kebersihan, skor_kerapihan, skor_sarpras, skor_ketertiban, catatan_temuan, foto_bukti
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, String(ruangan).trim(), tanggal, colors.kebersihan, colors.kerapihan, colors.sarpras,
        colors.ketertiban, scores.kebersihan, scores.kerapihan, scores.sarpras, scores.ketertiban, note || null, uploadedPath]
    );
    return res.status(201).json({ success: true, message: 'Patroli berhasil disimpan.', data: { id: result.insertId } });
  } catch (error) {
    if (uploadedFilePath) fs.unlink(uploadedFilePath, () => {});
    const status = error.message.includes('harus') ? 400 : 500;
    return res.status(status).json({ success: false, message: `Gagal menyimpan patroli: ${error.message}` });
  }
}

async function getPatrols(req, res) {
  try {
    if (!isDbConnected()) return res.status(503).json({ success: false, message: 'Database belum terhubung.' });
    const { start_date: startDate, end_date: endDate, findings } = req.query;
    const scope = getPatrolScope(req.user);
    let query = `
      SELECT p.*, u.nama AS petugas_nama, u.role AS petugas_role, u.bidang_id,
             b.nama_bidang, b.parent_role
      FROM patroli p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN bidang b ON b.id = u.bidang_id
      WHERE ${scope.clause}`;
    const params = [...scope.params];
    if (startDate) { query += ' AND p.tanggal >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND p.tanggal <= ?'; params.push(endDate); }
    if (findings === '1') query += ` AND (p.catatan_temuan IS NOT NULL AND TRIM(p.catatan_temuan) <> '')`;
    query += ' ORDER BY p.tanggal DESC, p.created_at DESC';
    const [rows] = await getPool().query(query, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: `Gagal mengambil data patroli: ${error.message}` });
  }
}

async function getPatrolDashboard(req, res) {
  try {
    const scope = getPatrolScope(req.user);
    const [rows] = await getPool().query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN p.catatan_temuan IS NOT NULL AND TRIM(p.catatan_temuan) <> ''
                         OR p.nilai_kebersihan = 'MERAH' OR p.nilai_kerapihan = 'MERAH'
                         OR p.nilai_sarpras = 'MERAH' OR p.nilai_ketertiban = 'MERAH' THEN 1 ELSE 0 END) AS total_temuan
       FROM patroli p JOIN users u ON u.id = p.user_id LEFT JOIN bidang b ON b.id = u.bidang_id
       WHERE ${scope.clause}`,
      scope.params
    );
    return res.json({ success: true, stats: rows[0] || { total: 0, total_temuan: 0 } });
  } catch (error) {
    return res.status(500).json({ success: false, message: `Gagal mengambil statistik patroli: ${error.message}` });
  }
}

async function updatePatrol(req, res) {
  try {
    const [rows] = await getPool().query('SELECT * FROM patroli WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Data patroli tidak ditemukan.' });
    const current = rows[0];
    const canEdit = current.user_id === req.user.id || ['SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS', 'KABID'].includes(req.user.role);
    if (!canEdit) return res.status(403).json({ success: false, message: 'Anda tidak dapat mengubah data patroli ini.' });
    const body = req.body;
    const colors = {
      kebersihan: normalizeColor(body.nilai_kebersihan || current.nilai_kebersihan, 'Nilai kebersihan'),
      kerapihan: normalizeColor(body.nilai_kerapihan || current.nilai_kerapihan, 'Nilai kerapihan'),
      sarpras: normalizeColor(body.nilai_sarpras || current.nilai_sarpras, 'Nilai sarpras'),
      ketertiban: normalizeColor(body.nilai_ketertiban || current.nilai_ketertiban, 'Nilai ketertiban')
    };
    const scores = {
      kebersihan: normalizeScore(body.skor_kebersihan ?? current.skor_kebersihan, 'Skor kebersihan'),
      kerapihan: normalizeScore(body.skor_kerapihan ?? current.skor_kerapihan, 'Skor kerapihan'),
      sarpras: normalizeScore(body.skor_sarpras ?? current.skor_sarpras, 'Skor sarpras'),
      ketertiban: normalizeScore(body.skor_ketertiban ?? current.skor_ketertiban, 'Skor ketertiban')
    };
    const note = String(body.catatan_temuan ?? current.catatan_temuan ?? '').trim();
    if (Object.values(colors).includes('MERAH') && !note) return res.status(400).json({ success: false, message: 'Catatan temuan wajib diisi jika ada penilaian MERAH.' });
    const roomName = String(body.ruangan || current.ruangan).trim();
    const [roomRows] = await getPool().query('SELECT id FROM patroli_ruangan WHERE nama_ruangan = ? AND is_active = 1', [roomName]);
    if (!roomRows.length) return res.status(400).json({ success: false, message: 'Area patroli tidak terdaftar.' });
    const photo = req.file ? `/uploads/${req.file.filename}` : current.foto_bukti;
    await getPool().query(
      `UPDATE patroli SET ruangan = ?, tanggal = ?, nilai_kebersihan = ?, nilai_kerapihan = ?, nilai_sarpras = ?, nilai_ketertiban = ?,
       skor_kebersihan = ?, skor_kerapihan = ?, skor_sarpras = ?, skor_ketertiban = ?, catatan_temuan = ?, foto_bukti = ? WHERE id = ?`,
      [roomName, body.tanggal || current.tanggal, colors.kebersihan, colors.kerapihan, colors.sarpras,
        colors.ketertiban, scores.kebersihan, scores.kerapihan, scores.sarpras, scores.ketertiban, note || null, photo, req.params.id]
    );
    return res.json({ success: true, message: 'Data patroli berhasil diperbarui.' });
  } catch (error) {
    return res.status(400).json({ success: false, message: `Gagal memperbarui patroli: ${error.message}` });
  }
}

async function deletePatrol(req, res) {
  try {
    const [rows] = await getPool().query('SELECT user_id FROM patroli WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Data patroli tidak ditemukan.' });
    const canDelete = rows[0].user_id === req.user.id || ['SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS', 'KABID'].includes(req.user.role);
    if (!canDelete) return res.status(403).json({ success: false, message: 'Anda tidak dapat menghapus data patroli ini.' });
    await getPool().query('DELETE FROM patroli WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Data patroli berhasil dihapus.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: `Gagal menghapus patroli: ${error.message}` });
  }
}

module.exports = {
  getRooms, createRoom, createPatrol, getPatrols, getPatrolDashboard, updatePatrol, deletePatrol,
  canCreatePatrol, canAccessPatrol
};
