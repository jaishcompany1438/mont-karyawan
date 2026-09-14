const { getPool, isDbConnected } = require('../config/db');

// Helper function to create notification from any controller
async function createNotification({ userId, judul, pesan, tipe = 'INFO', referenceId = null, referenceType = null }) {
  if (!isDbConnected()) return null;
  try {
    const db = getPool();
    const [result] = await db.query(
      `INSERT INTO notifications (user_id, judul, pesan, tipe, reference_id, reference_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, judul, pesan, tipe, referenceId, referenceType]
    );
    return result.insertId;
  } catch (error) {
    console.error('[Notification Helper Error]:', error.message);
    return null;
  }
}

// GET /api/notifications
async function getNotifications(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: 'Database belum terhubung.' });
    }

    const userId = req.user.id;
    const db = getPool();

    const [rows] = await db.query(
      `SELECT id, judul, pesan, tipe, reference_id, reference_type, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    const [unreadCount] = await db.query(
      `SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );

    return res.json({
      success: true,
      data: rows,
      unreadCount: unreadCount[0]?.unread || 0
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil notifikasi: ' + error.message });
  }
}

// PATCH /api/notifications/:id/read
async function markAsRead(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const db = getPool();

    await db.query(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    return res.json({ success: true, message: 'Notifikasi ditandai telah dibaca.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui notifikasi: ' + error.message });
  }
}

// PATCH /api/notifications/read-all
async function markAllAsRead(req, res) {
  try {
    const userId = req.user.id;
    const db = getPool();

    await db.query(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ?`,
      [userId]
    );

    return res.json({ success: true, message: 'Semua notifikasi ditandai telah dibaca.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui notifikasi: ' + error.message });
  }
}

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead
};
