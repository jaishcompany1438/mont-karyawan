const ExcelJS = require('exceljs');
const { getPool, isDbConnected } = require('../config/db');

// GET /api/reports/dashboard
async function getDashboardStats(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: 'Database belum terhubung.' });
    }

    const { role, bidang_id, id: userId } = req.user;
    const { periode, bidang_id: filterBidangId } = req.query;
    const db = getPool();

    let whereClause = '1=1';
    const params = [];

    if (role === 'STAF') {
      whereClause += ' AND assigned_to = ?';
      params.push(userId);
    } else if (role === 'KABID') {
      whereClause += ' AND (bidang_id = ? OR created_by = ? OR assigned_to = ?)';
      params.push(bidang_id, userId, userId);
    }

    if (filterBidangId) {
      whereClause += ' AND bidang_id = ?';
      params.push(filterBidangId);
    }

    if (periode && ['HARIAN', 'PEKANAN', 'BULANAN', 'TAHUNAN'].includes(periode.toUpperCase())) {
      whereClause += ' AND periode = ?';
      params.push(periode.toUpperCase());
    }

    // Overall stats for current period filter
    const [counts] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status = 'TO_DO' THEN 1 ELSE 0 END) AS to_do,
        SUM(CASE WHEN status = 'UNDER_REVIEW' THEN 1 ELSE 0 END) AS under_review,
        SUM(CASE WHEN status = 'REVISION' THEN 1 ELSE 0 END) AS revision,
        SUM(CASE WHEN status != 'COMPLETED' AND due_date < NOW() THEN 1 ELSE 0 END) AS overdue
      FROM tasks
      WHERE ${whereClause}
    `, params);

    // Distribution across all 4 periods
    let periodParams = [];
    let periodWhere = '1=1';
    if (role === 'STAF') {
      periodWhere += ' AND assigned_to = ?';
      periodParams.push(userId);
    } else if (role === 'KABID') {
      periodWhere += ' AND (bidang_id = ? OR created_by = ? OR assigned_to = ?)';
      periodParams.push(bidang_id, userId, userId);
    }
    if (filterBidangId) {
      periodWhere += ' AND bidang_id = ?';
      periodParams.push(filterBidangId);
    }

    const [byPeriod] = await db.query(`
      SELECT
        periode,
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status != 'COMPLETED' AND due_date < NOW() THEN 1 ELSE 0 END) AS overdue
      FROM tasks
      WHERE ${periodWhere}
      GROUP BY periode
    `, periodParams);

    // Department completion summary (for leadership / Mudir / Wakil Mudir / Super Admin)
    let departmentSummary = [];
    if (['SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR'].includes(role)) {
      const [deptRows] = await db.query(`
        SELECT
          b.id, b.nama_bidang, b.kode_bidang,
          COUNT(t.id) AS total_tasks,
          SUM(CASE WHEN t.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_tasks,
          SUM(CASE WHEN t.status IN ('TO_DO', 'REVISION', 'UNDER_REVIEW') THEN 1 ELSE 0 END) AS pending_tasks,
          SUM(CASE WHEN t.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS in_progress_tasks,
          SUM(CASE WHEN t.status = 'UNDER_REVIEW' THEN 1 ELSE 0 END) AS under_review_tasks,
          SUM(CASE WHEN t.status != 'COMPLETED' AND t.due_date < NOW() THEN 1 ELSE 0 END) AS overdue_tasks
        FROM bidang b
        LEFT JOIN tasks t ON b.id = t.bidang_id
        GROUP BY b.id
        ORDER BY b.nama_bidang ASC
      `);
      departmentSummary = deptRows;
    }

    return res.json({
      success: true,
      stats: counts[0] || { total: 0, completed: 0, in_progress: 0, to_do: 0, under_review: 0, revision: 0, overdue: 0 },
      byPeriod,
      departmentSummary
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil statistik dashboard: ' + error.message });
  }
}

// GET /api/reports/export/excel
async function exportExcelReport(req, res) {
  try {
    const { role, bidang_id, id: userId } = req.user;
    const { periode, status, bidang_id: filterBidangId } = req.query;
    const db = getPool();

    let query = `
      SELECT t.*,
             creator.nama AS creator_nama,
             assignee.nama AS assignee_nama, assignee.email AS assignee_email,
             assignee.jabatan AS assignee_jabatan, assignee.sub_bidang AS assignee_sub_bidang,
             b.nama_bidang, b.kode_bidang
      FROM tasks t
      JOIN users creator ON t.created_by = creator.id
      JOIN users assignee ON t.assigned_to = assignee.id
      JOIN bidang b ON t.bidang_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (role === 'STAF') {
      query += ' AND t.assigned_to = ?';
      params.push(userId);
    } else if (role === 'KABID') {
      query += ' AND (t.bidang_id = ? OR t.created_by = ? OR t.assigned_to = ?)';
      params.push(bidang_id, userId, userId);
    }

    if (periode) {
      query += ' AND t.periode = ?';
      params.push(periode.toUpperCase());
    }
    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }
    if (filterBidangId) {
      query += ' AND t.bidang_id = ?';
      params.push(filterBidangId);
    }

    query += ' ORDER BY t.periode ASC, t.due_date ASC';

    const [rows] = await db.query(query, params);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PTQ Imam Ath Thobari Monitoring System';
    const worksheet = workbook.addWorksheet('Rekap Kinerja Tugas');

    worksheet.columns = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'Judul Tugas', key: 'judul', width: 35 },
      { header: 'Periode', key: 'periode', width: 14 },
      { header: 'Kategori', key: 'kategori', width: 14 },
      { header: 'Prioritas', key: 'prioritas', width: 14 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Penerima Tugas (Assignee)', key: 'assignee', width: 25 },
      { header: 'Jabatan / Sub-Bidang', key: 'assignee_position', width: 32 },
      { header: 'Pemberi Tugas', key: 'creator', width: 22 },
      { header: 'Bidang / Divisi', key: 'bidang', width: 25 },
      { header: 'Tenggat Waktu (Due Date)', key: 'due_date', width: 22 },
      { header: 'Catatan Revisi', key: 'catatan_revisi', width: 30 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Slate 800
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 26;

    rows.forEach((row, index) => {
      worksheet.addRow({
        no: index + 1,
        judul: row.judul,
        periode: row.periode,
        kategori: row.kategori,
        prioritas: row.prioritas,
        status: row.status,
        assignee: `${row.assignee_nama} (${row.assignee_email})`,
        assignee_position: [row.assignee_jabatan, row.assignee_sub_bidang].filter(Boolean).join(' / ') || '-',
        creator: row.creator_nama,
        bidang: row.nama_bidang,
        due_date: new Date(row.due_date).toLocaleString('id-ID'),
        catatan_revisi: row.catatan_revisi || '-'
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="rekap_kinerja_${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error('Export report error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengekspor laporan: ' + error.message });
  }
}

module.exports = {
  getDashboardStats,
  exportExcelReport
};
