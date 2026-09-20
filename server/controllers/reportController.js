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

    if (periode && ['HARIAN', 'PEKANAN', 'BULANAN', 'TAHUNAN', 'INSIDENTAL'].includes(periode.toUpperCase())) {
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
             b.nama_bidang, b.kode_bidang,
             t.deskripsi AS catatan_tugas,
             t.catatan_reviewer,
             t.nilai_sop, t.nilai_waktu, t.nilai_kualitas
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
    if (role === 'KABID') {
      query += ' AND t.bidang_id = ?';
      params.push(bidang_id);
    } else if (filterBidangId) {
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
      { header: 'Catatan Revisi', key: 'catatan_revisi', width: 30 },
      { header: 'Kendala dan Solusi', key: 'kendala_solusi', width: 38 }
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
        catatan_revisi: row.catatan_revisi || '-',
        kendala_solusi: formatKendalaSolusi(row.kendala, row.solusi)
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

function formatKendalaSolusi(kendala, solusi) {
  const sections = [];
  const issue = String(kendala || '').trim();
  const resolution = String(solusi || '').trim();
  if (issue) sections.push(`Kendala:\n${issue}`);
  if (resolution) sections.push(`Solusi:\n${resolution}`);
  return sections.join('\n\n') || '-';
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

function parseReportDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getExpectedOccurrences(period, category, startDate, endDate, actualCount) {
  if (category === 'MENDADAK' || period === 'INSIDENTAL') return actualCount;
  if (!startDate || !endDate || endDate < startDate) return actualCount;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (period === 'PEKANAN') {
    return Math.floor((end - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
  }
  if (period === 'BULANAN') {
    return (end.getFullYear() - start.getFullYear()) * 12
      + end.getMonth() - start.getMonth() + 1;
  }
  if (period === 'TAHUNAN') {
    return end.getFullYear() - start.getFullYear() + 1;
  }
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

function aggregateReportRows(rows, filters = {}) {
  const startDate = parseReportDate(filters.start_date);
  const endDate = parseReportDate(filters.end_date);
  const groups = rows.reduce((result, row) => {
    const key = String(row.judul || row.deskripsi || '-').trim();
    if (!result[key]) {
      result[key] = {
        judul: key,
        deskripsi: row.deskripsi || row.judul || '-',
        periode: row.periode || 'HARIAN',
        category: row.kategori || 'RUTIN',
        frequency: 0,
        completed: 0,
        totalBudget: 0,
        totalSpent: 0,
        taskNotes: [],
        reviewerNotes: [],
        kendalaNotes: [],
        solusiNotes: [],
        ratings: []
      };
    }
    const group = result[key];
    group.frequency += 1;
    if (['COMPLETED', 'DONE'].includes(row.status)) group.completed += 1;
    group.totalBudget += Number(row.anggaran_dana || 0);
    group.totalSpent += Number(row.anggaran_terpakai || 0);
    const taskNote = String(row.catatan_tugas || row.deskripsi || '').trim();
    const reviewerNote = String(row.catatan_reviewer || row.catatan_revisi || '').trim();
    if (taskNote) group.taskNotes.push(taskNote);
    if (reviewerNote) group.reviewerNotes.push(reviewerNote);
    const kendala = String(row.kendala || '').trim();
    const solusi = String(row.solusi || '').trim();
    if (kendala) group.kendalaNotes.push(kendala);
    if (solusi) group.solusiNotes.push(solusi);
    [row.nilai_sop, row.nilai_waktu, row.nilai_kualitas].forEach((value) => {
      if (value !== null && value !== undefined && value !== '') group.ratings.push(Number(value));
    });
    return result;
  }, {});

  return Object.values(groups).map((group) => {
    const target = getExpectedOccurrences(group.periode, group.category, startDate, endDate, group.frequency);
    const progress = target > 0 ? Math.min(100, Math.round((group.completed / target) * 100)) : 0;
    return {
      ...group,
      target,
      progress,
      remaining: group.totalBudget - group.totalSpent,
      catatan_tugas: [...new Set(group.taskNotes)].slice(-3).join('\n- '),
      catatan_reviewer: [...new Set(group.reviewerNotes)].slice(-3).join('\n- '),
      kendala_solusi: formatKendalaSolusi(
        [...new Set(group.kendalaNotes)].slice(-3).join('\n- '),
        [...new Set(group.solusiNotes)].slice(-3).join('\n- ')
      ),
      penilaian: group.ratings.length
        ? (group.ratings.reduce((sum, value) => sum + value, 0) / group.ratings.length).toFixed(1)
        : '-'
    };
  });
}

function getPeriodLabel(period) {
  return {
    HARIAN: 'Harian',
    PEKANAN: 'Pekanan',
    BULANAN: 'Bulanan',
    TAHUNAN: 'Tahunan',
    INSIDENTAL: 'Insidental'
  }[period] || period || '-';
}

function getReportPeriodText(row) {
  if (row.category === 'MENDADAK') return `Sekali (${row.frequency}x)`;
  return `${getPeriodLabel(row.periode)} (${row.frequency}x)`;
}

function getReportSummary(rows, aggregatedRows, filters) {
  const startDate = parseReportDate(filters.start_date);
  const endDate = parseReportDate(filters.end_date);
  const totalWorkDays = startDate && endDate && endDate >= startDate
    ? Math.floor((endDate - startDate) / (24 * 60 * 60 * 1000)) + 1
    : new Set(rows.map((row) => new Date(row.due_date).toISOString().slice(0, 10))).size;
  return {
    totalWorkDays,
    completedPrograms: aggregatedRows.filter((row) => row.progress >= 100).length,
    totalBudget: aggregatedRows.reduce((sum, row) => sum + row.totalBudget, 0)
  };
}

function createReportPdf(rows, filters, ownerName = '') {
  const selected = String(filters.selected_columns || 'judul,periode')
    .split(',')
    .map((column) => column.trim())
    .filter(Boolean);
  const allowedColumns = ['judul', 'periode', 'progress', 'total_anggaran', 'sisa_saldo', 'catatan_tugas', 'kendala_solusi', 'catatan_reviewer', 'penilaian'];
  const selectedColumns = [...new Set(['judul', 'periode', ...selected.filter((column) => allowedColumns.includes(column))])];
  const columnDefinitions = {
    judul: { label: 'Judul Tugas', width: 190, value: (row, index) => `${index + 1}. ${row.judul || '-'}` },
    periode: { label: 'Periode', width: 100, value: (row) => getReportPeriodText(row) },
    progress: { label: 'Progress', width: 58, value: (row) => `${row.progress}%`, align: 'right' },
    total_anggaran: { label: 'Total Anggaran', width: 92, value: (row) => formatPdfCurrency(row.totalBudget), align: 'right' },
    sisa_saldo: { label: 'Sisa Saldo', width: 92, value: (row) => formatPdfCurrency(row.remaining), align: 'right' },
    catatan_tugas: { label: 'Catatan Tugas', width: 130, value: (row) => row.catatan_tugas || '-' },
    kendala_solusi: { label: 'Kendala dan Solusi', width: 145, value: (row) => row.kendala_solusi || '-' },
    catatan_reviewer: { label: 'Catatan Reviewer', width: 130, value: (row) => row.catatan_reviewer || '-' },
    penilaian: { label: 'Penilaian', width: 65, value: (row) => row.penilaian || '-', align: 'right' }
  };
  const estimatedWidth = selectedColumns.reduce((sum, key) => sum + columnDefinitions[key].width, 0);
  const landscape = estimatedWidth > 515;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: landscape ? 'landscape' : 'portrait', margin: 0, bufferPages: true, autoFirstPage: false });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = landscape ? 841.89 : 595.28;
    const pageHeight = landscape ? 595.28 : 841.89;
    const margin = 42;
    const signatureHeight = 92;
    const signatureTop = pageHeight - margin - signatureHeight;
    const contentWidth = pageWidth - margin * 2;
    const green = '#047857';
    const lightGreen = '#ECFDF5';
    const border = '#D1D5DB';
    const muted = '#64748B';
    const logo = getReportLogo();
    const aggregatedRows = aggregateReportRows(rows, filters);
    const summary = getReportSummary(rows, aggregatedRows, filters);
    const bidangNames = [...new Set(rows.map((row) => row.nama_bidang).filter(Boolean))];
    const bidangName = filters.nama_bidang || (bidangNames.length ? bidangNames.join(', ') : 'Semua Bidang');
    const widthScale = contentWidth / estimatedWidth;
    let cursor = margin;
    const columns = selectedColumns.map((key) => {
      const definition = columnDefinitions[key];
      const column = { key, ...definition, x: cursor, width: definition.width * widthScale };
      cursor += column.width;
      return column;
    });

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
      doc.fillColor(muted).font('Helvetica-Bold').fontSize(9).text('Pemilik Laporan :', margin, y);
      doc.fillColor('#0F172A').font('Helvetica').fontSize(11).text(bidangName, margin, y + 14);
      return y + 42;
    };

    const drawSummary = (y) => {
      const boxHeight = 48;
      const boxWidth = contentWidth / 3;
      const items = [
        ['Total Hari Kerja', `${summary.totalWorkDays} Hari`],
        ['Total Program Selesai', `${summary.completedPrograms}`],
        ['Total Anggaran Keseluruhan', formatPdfCurrency(summary.totalBudget)]
      ];
      items.forEach(([label, value], index) => {
        const x = margin + index * boxWidth;
        doc.save().roundedRect(x, y, boxWidth - 5, boxHeight, 7).fill('#F8FAFC').restore();
        doc.fillColor(muted).font('Helvetica').fontSize(7.5).text(label, x + 8, y + 10, {
          width: boxWidth - 21
        });
        doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(index === 2 ? 9 : 11)
          .text(value, x + 8, y + 26, { width: boxWidth - 21 });
      });
      return y + boxHeight + 16;
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

    const drawSignatures = () => {
      const gap = 28;
      const boxWidth = (contentWidth - gap) / 2;
      const leftX = margin;
      const rightX = margin + boxWidth + gap;
      const lineY = signatureTop + 42;
      doc.fillColor('#0F172A').font('Helvetica').fontSize(9)
        .text('Pemilik Laporan', leftX, signatureTop, { width: boxWidth, align: 'center' })
        .text('Pemeriksa', rightX, signatureTop, { width: boxWidth, align: 'center' });
      doc.strokeColor('#64748B').lineWidth(0.6)
        .moveTo(leftX + 18, lineY).lineTo(leftX + boxWidth - 18, lineY).stroke()
        .moveTo(rightX + 18, lineY).lineTo(rightX + boxWidth - 18, lineY).stroke();
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(9)
        .text(ownerName || '____________________________', leftX, lineY + 7, {
          width: boxWidth,
          align: 'center'
        })
        .text('', rightX, lineY + 7, {
          width: boxWidth,
          align: 'center'
        });
    };

    const getRowHeight = (row) => {
      const heights = columns.map((column) => doc.heightOfString(column.value(row, 0), {
        width: Math.max(20, column.width - 16),
        fontSize: column === columns[0] ? 8.5 : 8
      }));
      return Math.max(31, Math.ceil(Math.max(...heights) + 16));
    };

    let y = drawHeader();
    y = drawSummary(y);
    y = drawTableHeader(y);
    doc.font('Helvetica').fontSize(8).fillColor('#1E293B');

    aggregatedRows.forEach((row, index) => {
      const rowHeight = getRowHeight(row);
      if (y + rowHeight > pageHeight - 76) {
        y = drawHeader();
        y = drawTableHeader(y);
      }
      if (index % 2 === 0) {
        doc.save().rect(margin, y, contentWidth, rowHeight).fill('#F8FAFC').restore();
      }
      doc.strokeColor(border).lineWidth(0.45).moveTo(margin, y + rowHeight).lineTo(margin + contentWidth, y + rowHeight).stroke();
      columns.forEach((column, columnIndex) => {
        const value = column.value(row, index);
        if (column.key === 'periode' && row.periode === 'TAHUNAN') {
          doc.save().rect(column.x, y, column.width, rowHeight).fill('#b5f7cc').restore();
        } else if (column.key === 'periode' && row.periode === 'INSIDENTAL') {
          doc.save().rect(column.x, y, column.width, rowHeight).fill('#fff0b2').restore();
        }
        const textColor = column.key === 'periode' && row.periode === 'TAHUNAN'
          ? '#104926'
          : column.key === 'periode' && row.periode === 'INSIDENTAL'
            ? '#92400E'
            : '#1E293B';
        doc.fillColor(textColor).font('Helvetica')
          .fontSize(columnIndex === 0 ? 8.5 : 8)
          .text(value, column.x + 8, y + 8, {
            width: column.width - 16,
            height: rowHeight - 12,
            align: column.align || 'left'
          });
      });
      y += rowHeight;
    });

    if (!aggregatedRows.length) {
      doc.save().roundedRect(margin, y, contentWidth, 38, 7).fill('#F8FAFC').restore();
      doc.fillColor(muted).font('Helvetica').fontSize(9).text('Tidak ada data pada periode ini.', margin + 10, y + 14);
      y += 38;
    }
    if (y + 53 > signatureTop - 12) {
      y = drawHeader();
    }
    doc.save().roundedRect(margin, y + 18, contentWidth, 35, 8).fill(lightGreen).restore();
    doc.fillColor(green).font('Helvetica-Bold').fontSize(10)
      .text('TOTAL SISA SALDO', margin + 12, y + 31);
    const totalRemaining = aggregatedRows.reduce((sum, row) => sum + row.remaining, 0);
    doc.text(formatPdfCurrency(totalRemaining), margin + contentWidth - 170, y + 31, {
      width: 158,
      align: 'right'
    });
    drawSignatures();
    doc.end();
  });
}

async function exportPdfReport(req, res) {
  try {
    const rows = await getReportRows(req);
    const pdf = await createReportPdf(rows, req.query, req.user.nama);
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
  exportPdfReport,
  aggregateReportRows
};
