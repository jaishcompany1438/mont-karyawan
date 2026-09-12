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
    } else if (role === 'WADIR_PEND' || role === 'WADIR_PENGS') {
      whereClause += ' AND (EXISTS (SELECT 1 FROM bidang bx WHERE bx.id = bidang_id AND bx.parent_role = ?) OR created_by = ? OR assigned_to = ?)';
      params.push(role, userId, userId);
    } else if (role === 'WAKIL_MUDIR') {
      whereClause += ' AND (created_by = ? OR assigned_to = ?)';
      params.push(userId, userId);
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
    } else if (role === 'WADIR_PEND' || role === 'WADIR_PENGS') {
      periodWhere += ' AND (EXISTS (SELECT 1 FROM bidang bx WHERE bx.id = bidang_id AND bx.parent_role = ?) OR created_by = ? OR assigned_to = ?)';
      periodParams.push(role, userId, userId);
    } else if (role === 'WAKIL_MUDIR') {
      periodWhere += ' AND (created_by = ? OR assigned_to = ?)';
      periodParams.push(userId, userId);
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
    if (['SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS'].includes(role)) {
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
        WHERE (? IS NULL OR b.parent_role = ?)
        GROUP BY b.id
        ORDER BY b.nama_bidang ASC
      `, [role === 'WADIR_PEND' || role === 'WADIR_PENGS' ? role : null, role]);
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

async function getReportRows(req) {
    const { role, bidang_id, id: userId } = req.user;
    const { periode, status, bidang_id: filterBidangId, start_date: startDate, end_date: endDate } = req.query;
    const db = getPool();

    let query = `
      SELECT t.*,
             creator.nama AS creator_nama,
             assignee.nama AS assignee_nama, assignee.email AS assignee_email, assignee.no_telepon AS assignee_no_telepon,
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
    } else if (role === 'WADIR_PEND' || role === 'WADIR_PENGS') {
      query += ' AND (b.parent_role = ? OR t.created_by = ? OR t.assigned_to = ?)';
      params.push(role, userId, userId);
    } else if (role === 'WAKIL_MUDIR') {
      query += ' AND (t.created_by = ? OR t.assigned_to = ?)';
      params.push(userId, userId);
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
    if (startDate) {
      query += ' AND t.due_date >= ?';
      params.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      query += ' AND t.due_date <= ?';
      params.push(`${endDate} 23:59:59`);
    }

    query += ' ORDER BY t.periode ASC, t.due_date ASC';

    const [rows] = await db.query(query, params);
    return rows;
}

// GET /api/reports/export/excel
async function exportExcelReport(req, res) {
  try {
    const rows = await getReportRows(req);
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
      { header: 'Anggaran Dana', key: 'anggaran_dana', width: 18 },
      { header: 'Anggaran Terpakai', key: 'anggaran_terpakai', width: 20 },
      { header: 'Sisa Saldo', key: 'sisa_saldo', width: 18 },
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
        anggaran_dana: Number(row.anggaran_dana || 0),
        anggaran_terpakai: Number(row.anggaran_terpakai || 0),
        sisa_saldo: Number(row.anggaran_dana || 0) - Number(row.anggaran_terpakai || 0),
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

function pdfEscape(value) {
  return String(value || '-').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function createReportPdf(rows, filters) {
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 32;
  const totalRemaining = rows.reduce((sum, row) => sum + Number(row.anggaran_dana || 0) - Number(row.anggaran_terpakai || 0), 0);
  const lines = [
    'LAPORAN REKAP KINERJA TUGAS',
    'PTQ Imam Ath Thobari',
    `Periode: ${filters.start_date || '-'} s/d ${filters.end_date || '-'}`,
    'Deskripsi                         Status             Anggaran Terpakai       Sisa Saldo',
    ''
  ];
  rows.forEach((row, index) => {
    lines.push(`${index + 1}. ${(row.deskripsi || row.judul).slice(0, 32)} | ${row.status} | Rp ${Number(row.anggaran_terpakai || 0).toLocaleString('id-ID')} | Rp ${(Number(row.anggaran_dana || 0) - Number(row.anggaran_terpakai || 0)).toLocaleString('id-ID')}`);
    lines.push(`   Program: ${row.judul.slice(0, 70)} | Penerima: ${row.assignee_nama}`);
    lines.push('');
  });
  lines.push(`TOTAL SISA SALDO: Rp ${totalRemaining.toLocaleString('id-ID')}`);

  const content = [];
  let y = pageHeight - margin;
  lines.forEach((line, index) => {
    if (y < margin) return;
    const fontSize = index < 2 ? 16 : 9;
    const font = index < 2 ? '/F2' : '/F1';
    if (index >= 5 && line) {
      content.push(`q 0.96 0.98 0.97 rg ${margin - 5} ${y - 4} 778 15 re f Q`);
    }
    content.push(`BT ${font} ${fontSize} Tf ${margin} ${y} Td (${pdfEscape(line.slice(0, 125))}) Tj ET`);
    y -= index < 2 ? 22 : 13;
  });

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${content.join('\n').length} >>\nstream\n${content.join('\n')}\nendstream`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, 'utf8');
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

async function exportPdfReport(req, res) {
  try {
    const rows = await getReportRows(req);
    const pdf = createReportPdf(rows, req.query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="rekap_kinerja_${Date.now()}.pdf"`);
    return res.send(pdf);
  } catch (error) {
    console.error('Export PDF report error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengekspor PDF: ' + error.message });
  }
}

module.exports = {
  getDashboardStats,
  exportExcelReport,
  exportPdfReport
};
