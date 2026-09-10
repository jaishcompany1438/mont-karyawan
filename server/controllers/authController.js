const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool, isDbConnected } = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
    }

    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Koneksi database belum tersedia. Pastikan MySQL aktif dan database terhubung.'
      });
    }

    const db = getPool();
    const [rows] = await db.query(
      `SELECT u.id, u.nama, u.email, u.password, u.role, u.bidang_id, u.jabatan, u.sub_bidang,
              b.nama_bidang, b.kode_bidang, b.parent_role
       FROM users u
       LEFT JOIN bidang b ON u.bidang_id = b.id
       WHERE u.email = ? LIMIT 1`,
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Email atau password salah.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email atau password salah.' });
    }

    const payload = {
      id: user.id,
      nama: user.nama,
      email: user.email,
      role: user.role,
      bidang_id: user.bidang_id,
      nama_bidang: user.nama_bidang,
      kode_bidang: user.kode_bidang,
      jabatan: user.jabatan,
      sub_bidang: user.sub_bidang
      ,parent_role: user.parent_role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

    return res.json({
      success: true,
      message: 'Login berhasil.',
      token,
      user: payload
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat login: ' + error.message });
  }
}

async function getMe(req, res) {
  try {
    if (!isDbConnected()) {
      return res.json({ success: true, user: req.user });
    }

    const db = getPool();
    const [rows] = await db.query(
      `SELECT u.id, u.nama, u.email, u.role, u.bidang_id, u.jabatan, u.sub_bidang,
              b.nama_bidang, b.kode_bidang, b.parent_role
       FROM users u
       LEFT JOIN bidang b ON u.bidang_id = b.id
       WHERE u.id = ? LIMIT 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    return res.json({ success: true, user: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data profil: ' + error.message });
  }
}

module.exports = {
  login,
  getMe
};
