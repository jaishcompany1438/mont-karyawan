const { getPool, isDbConnected } = require('../config/db');
const { createNotification } = require('./notificationController');

// POST /api/cross-requests
async function createCrossRequest(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: 'Database belum terhubung.' });
    }

    const { id: fromUserId, bidang_id: fromBidangId, nama: fromUserNama } = req.user;
    const { target_bidang_id, judul, deskripsi, urgensi = 'SEDANG', due_date } = req.body;

    if (!target_bidang_id || !judul || !deskripsi || !due_date) {
      return res.status(400).json({
        success: false,
        message: 'Bidang tujuan, judul tugas, deskripsi, dan batas waktu wajib diisi.'
      });
    }

    const effectiveFromBidangId = fromBidangId || 1;
    const file_attachment = req.file ? `/uploads/${req.file.filename}` : null;
    const db = getPool();

    // Verify target department exists
    const [targetDept] = await db.query('SELECT id, nama_bidang FROM bidang WHERE id = ?', [target_bidang_id]);
    if (targetDept.length === 0) {
      return res.status(400).json({ success: false, message: 'Bidang tujuan tidak ditemukan.' });
    }

    const [result] = await db.query(
      `INSERT INTO cross_department_requests (
        judul, deskripsi, urgensi, due_date, file_attachment, status,
        from_user_id, from_bidang_id, target_bidang_id
      ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
      [
        judul.trim(),
        deskripsi.trim(),
        urgensi,
        new Date(due_date),
        file_attachment,
        fromUserId,
        effectiveFromBidangId,
        target_bidang_id
      ]
    );

    const requestId = result.insertId;

    // Send notification to Kabid of the target department and leadership
    const [targetLeaders] = await db.query(
      `SELECT id FROM users WHERE (bidang_id = ? AND role = 'KABID') OR role IN ('MUDIR', 'SUPER_ADMIN')`,
      [target_bidang_id]
    );

    for (const leader of targetLeaders) {
      await createNotification({
        userId: leader.id,
        judul: `Pengajuan Lintas Bidang: ${judul.trim()}`,
        pesan: `${fromUserNama} mengajukan permintaan tugas lintas bidang ke ${targetDept[0].nama_bidang}. Urgensi: ${urgensi}.`,
        tipe: 'PENGAJUAN_LINTAS_BIDANG',
        referenceId: requestId,
        referenceType: 'cross_department_requests'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Pengajuan tugas lintas bidang berhasil dikirimkan.',
      data: { id: requestId }
    });
  } catch (error) {
    console.error('Error creating cross department request:', error);
    return res.status(500).json({ success: false, message: 'Gagal membuat pengajuan lintas bidang: ' + error.message });
  }
}

// GET /api/cross-requests
async function getCrossRequests(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: 'Database belum terhubung.' });
    }

    const { role, bidang_id: userBidangId, id: userId } = req.user;
    const { status, target_bidang_id } = req.query;
    const db = getPool();

    let query = `
      SELECT cr.*,
             u.nama AS from_user_nama, u.email AS from_user_email, u.jabatan AS from_user_jabatan,
             fb.nama_bidang AS from_bidang_nama, fb.kode_bidang AS from_bidang_kode,
             tb.nama_bidang AS target_bidang_nama, tb.kode_bidang AS target_bidang_kode
      FROM cross_department_requests cr
      JOIN users u ON cr.from_user_id = u.id
      JOIN bidang fb ON cr.from_bidang_id = fb.id
      JOIN bidang tb ON cr.target_bidang_id = tb.id
      WHERE 1=1
    `;
    const params = [];

    // RBAC:
    // Staf only sees requests they submitted
    if (role === 'STAF') {
      query += ' AND cr.from_user_id = ?';
      params.push(userId);
    } else if (role === 'KABID') {
      // Kabid sees incoming to their department OR outgoing from their department
      query += ' AND (cr.target_bidang_id = ? OR cr.from_bidang_id = ?)';
      params.push(userBidangId, userBidangId);
    }
    // Mudir, Wadir, Super Admin can see all

    if (status) {
      query += ' AND cr.status = ?';
      params.push(status);
    }

    if (target_bidang_id) {
      query += ' AND cr.target_bidang_id = ?';
      params.push(target_bidang_id);
    }

    query += ' ORDER BY cr.created_at DESC';

    const [rows] = await db.query(query, params);
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data pengajuan: ' + error.message });
  }
}

// PATCH /api/cross-requests/:id/respond
async function respondCrossRequest(req, res) {
  try {
    const { id } = req.params;
    const { status, catatan_tanggapan } = req.body; // status: 'APPROVED' or 'REJECTED'
    const { role, bidang_id: userBidangId, nama: responderNama } = req.user;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tanggapan harus APPROVED atau REJECTED.' });
    }

    const db = getPool();
    const [rows] = await db.query('SELECT * FROM cross_department_requests WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan.' });
    }

    const request = rows[0];

    // Check authority: Kabid of target_bidang_id, Mudir, Wadir, Super Admin
    const canRespond =
      ['SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS'].includes(role) ||
      (role === 'KABID' && request.target_bidang_id === userBidangId);

    if (!canRespond) {
      return res.status(403).json({
        success: false,
        message: 'Hanya Kepala Bidang tujuan atau Pimpinan yang berhak memberikan tanggapan pengajuan.'
      });
    }

    await db.query(
      `UPDATE cross_department_requests SET status = ?, catatan_tanggapan = ? WHERE id = ?`,
      [status, catatan_tanggapan || null, id]
    );

    // Notify requester
    await createNotification({
      userId: request.from_user_id,
      judul: status === 'APPROVED' ? `Pengajuan Disetujui: ${request.judul}` : `Pengajuan Ditolak: ${request.judul}`,
      pesan: `${responderNama} telah ${status === 'APPROVED' ? 'menyetujui' : 'menolak'} pengajuan tugas lintas bidang Anda.${catatan_tanggapan ? ' Catatan: ' + catatan_tanggapan : ''}`,
      tipe: status === 'APPROVED' ? 'PERINTAH_ATASAN' : 'REVISI_PEKERJAAN',
      referenceId: request.id,
      referenceType: 'cross_department_requests'
    });

    return res.json({
      success: true,
      message: `Pengajuan berhasil ${status === 'APPROVED' ? 'disetujui' : 'ditolak'}.`
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal merespons pengajuan: ' + error.message });
  }
}

module.exports = {
  createCrossRequest,
  getCrossRequests,
  respondCrossRequest
};
