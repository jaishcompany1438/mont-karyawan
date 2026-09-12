const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const SVGtoPDF = require('svg-to-pdfkit');
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

function formatPdfCurrency(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

function getReportLogo() {
  const candidates = [
    path.join(__dirname, '../../client/public/logo.svg'),
    path.join(__dirname, '../../client/dist/logo.svg')
  ];
  const logoPath = candidates.find((candidate) => fs.existsSync(candidate));
  return logoPath ? fs.readFileSync(logoPath, 'utf8') : null;
}

function getPdfStatus(status) {
  return {
    DONE: 'Selesai',
    IN_PROGRESS: 'Sedang Dikerjakan',
    TO_DO: 'Belum Mulai',
    REVIEW: 'Menunggu Review',
    REVISION: 'Perlu Revisi',
    OVERDUE: 'Lewat Waktu'
  }[status] || status || '-';
}

function createReportPdf(rows, filters) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, autoFirstPage: false });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 42;
    const contentWidth = pageWidth - margin * 2;
    const green = '#047857';
    const lightGreen = '#ECFDF5';
    const border = '#D1D5DB';
    const muted = '#64748B';
    const logo = getReportLogo();
    const bidangNames = [...new Set(rows.map((row) => row.nama_bidang).filter(Boolean))];
    const bidangName = filters.nama_bidang || (bidangNames.length ? bidangNames.join(', ') : 'Semua Bidang');
    const totalRemaining = rows.reduce(
      (sum, row) => sum + Number(row.anggaran_dana || 0) - Number(row.anggaran_terpakai || 0),
      0
    );
    const columns = [
      { label: 'Deskripsi program kerja', x: margin, width: 245 },
      { label: 'Status', x: margin + 245, width: 85 },
      { label: 'Anggaran terpakai', x: margin + 330, width: 105 },
      { label: 'Sisa Saldo', x: margin + 435, width: contentWidth - 435 }
    ];

    const drawHeader = () => {
      doc.addPage();
      let y = 42;
      if (logo) {
        SVGtoPDF(doc, logo, margin, y, { width: 54, height: 54 });
      } else {
        doc.roundedRect(margin, y, 54, 54, 10).fill(green);
      }
      const textX = margin + 68;
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(17)
        .text('LAPORAN REKAP KINERJA TUGAS', textX, y + 2, { width: contentWidth - 68 });
      doc.fontSize(11).text('PTQ Imam Ath Thobari', textX, y + 27);
      doc.fillColor(muted).font('Helvetica').fontSize(9)
        .text(`Periode: ${filters.start_date || '-'} s/d ${filters.end_date || '-'}`, textX, y + 43);
      y += 78;
      doc.fillColor(muted).font('Helvetica-Bold').fontSize(9).text('KABID :', margin, y);
      doc.fillColor('#0F172A').font('Helvetica').fontSize(11).text(bidangName, margin, y + 14);
      return y + 42;
    };

    const drawTableHeader = (y) => {
      doc.save().roundedRect(margin, y, contentWidth, 30, 7).fill(green).restore();
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
      columns.forEach((column) => doc.text(column.label, column.x + 8, y + 10, {
        width: column.width - 16,
        lineBreak: false
      }));
      return y + 30;
    };

    const getRowHeight = (row) => {
      const description = `${row.deskripsi || row.judul || '-'}${row.deskripsi && row.judul && row.deskripsi !== row.judul ? `\n${row.judul}` : ''}`;
      const descriptionHeight = doc.heightOfString(description, { width: columns[0].width - 16, fontSize: 8.5 });
      const statusHeight = doc.heightOfString(getPdfStatus(row.status), { width: columns[1].width - 16, fontSize: 8 });
      return Math.max(31, Math.ceil(Math.max(descriptionHeight, statusHeight) + 16));
    };

    let y = drawHeader();
    y = drawTableHeader(y);
    doc.font('Helvetica').fontSize(8).fillColor('#1E293B');

    rows.forEach((row, index) => {
      const rowHeight = getRowHeight(row);
      if (y + rowHeight > pageHeight - 76) {
        y = drawHeader();
        y = drawTableHeader(y);
      }
      const remaining = Number(row.anggaran_dana || 0) - Number(row.anggaran_terpakai || 0);
      if (index % 2 === 0) {
        doc.save().rect(margin, y, contentWidth, rowHeight).fill('#F8FAFC').restore();
      }
      doc.strokeColor(border).lineWidth(0.45).moveTo(margin, y + rowHeight).lineTo(margin + contentWidth, y + rowHeight).stroke();
      const values = [
        `${index + 1}. ${row.deskripsi || row.judul || '-'}`,
        getPdfStatus(row.status),
        formatPdfCurrency(row.anggaran_terpakai),
        formatPdfCurrency(remaining)
      ];
      values.forEach((value, columnIndex) => {
        const column = columns[columnIndex];
        doc.fillColor('#1E293B').font(columnIndex === 0 ? 'Helvetica' : 'Helvetica')
          .fontSize(columnIndex === 0 ? 8.5 : 8)
          .text(value, column.x + 8, y + 8, {
            width: column.width - 16,
            height: rowHeight - 12,
            align: columnIndex > 1 ? 'right' : 'left'
          });
      });
      y += rowHeight;
    });

    if (!rows.length) {
      doc.save().roundedRect(margin, y, contentWidth, 38, 7).fill('#F8FAFC').restore();
      doc.fillColor(muted).font('Helvetica').fontSize(9).text('Tidak ada data pada periode ini.', margin + 10, y + 14);
      y += 38;
    }
    if (y + 48 > pageHeight - 42) {
      y = drawHeader();
    }
    doc.save().roundedRect(margin, y + 18, contentWidth, 35, 8).fill(lightGreen).restore();
    doc.fillColor(green).font('Helvetica-Bold').fontSize(10)
      .text('TOTAL SISA SALDO', margin + 12, y + 31);
    doc.text(formatPdfCurrency(totalRemaining), margin + contentWidth - 170, y + 31, {
      width: 158,
      align: 'right'
    });
    doc.end();
  });
}

async function exportPdfReport(req, res) {
  try {
    const rows = await getReportRows(req);
    const pdf = await createReportPdf(rows, req.query);
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
