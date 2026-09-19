const ExcelJS = require('exceljs');
const bcrypt = require('bcryptjs');
const { getPool, isDbConnected } = require('../config/db');
const { parseHolidayExclusions } = require('./taskController');

// Download Excel Template (tugas, karyawan, bidang)
async function downloadTemplate(req, res) {
  try {
    const { type } = req.params;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PTQ Imam Ath Thobari Monitoring System';
    workbook.created = new Date();

    if (type === 'tugas') {
      const sheet = workbook.addWorksheet('Template Tugas');
      sheet.columns = [
        { header: 'Judul Tugas', key: 'judul', width: 35 },
        { header: 'Deskripsi', key: 'deskripsi', width: 45 },
        { header: 'Periode (HARIAN/PEKANAN/BULANAN/TAHUNAN/INSIDENTAL)', key: 'periode', width: 40 },
        { header: 'Email Assignee', key: 'email_assignee', width: 30 },
        { header: 'Prioritas (RENDAH/SEDANG/TINGGI/URGEN)', key: 'prioritas', width: 35 },
        { header: 'Due Date (YYYY-MM-DD HH:mm)', key: 'due_date', width: 30 },
        { header: 'Anggaran Dana (wajib, boleh 0)', key: 'anggaran_dana', width: 28 },
        { header: 'Anggaran Terpakai (boleh 0)', key: 'anggaran_terpakai', width: 28 },
        { header: 'Berulang? (YA/TIDAK, default YA untuk H/P/B)', key: 'is_recurring', width: 38 },
        { header: 'Pengecualian Hari Libur (SATURDAY,SUNDAY / YYYY-MM-DD, pisahkan koma)', key: 'libur_pengecualian', width: 45 }
      ];

      // Format Header
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' } // Dark Blue
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 28;

      // Sample Row
      sheet.addRow({
        judul: 'Contoh: Pemeliharaan Server Web & Database',
        deskripsi: 'Cek performa, disk usage, dan lakukan backup database harian',
        periode: 'HARIAN',
        email_assignee: 'staf.it@thobari.sch.id',
        prioritas: 'TINGGI',
        due_date: '2026-09-15 16:00',
        anggaran_dana: 0,
        anggaran_terpakai: 0,
        is_recurring: 'YA',
        libur_pengecualian: 'SATURDAY,SUNDAY'
      });

      // Data Validation / Instructions
      sheet.dataValidations.add('C2:C1000', {
        type: 'list',
        allowBlank: false,
        formulae: ['"HARIAN,PEKANAN,BULANAN,TAHUNAN,INSIDENTAL"']
      });

      sheet.dataValidations.add('E2:E1000', {
        type: 'list',
        allowBlank: false,
        formulae: ['"RENDAH,SEDANG,TINGGI,URGEN"']
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="template_tugas.xlsx"');
      await workbook.xlsx.write(res);
      return res.end();

    } else if (type === 'karyawan') {
      const sheet = workbook.addWorksheet('Template Karyawan');
      sheet.columns = [
        { header: 'Nama Lengkap', key: 'nama', width: 32 },
        { header: 'Email', key: 'email', width: 32 },
        { header: 'Password Awal', key: 'password', width: 22 },
        { header: 'Role (MUDIR/WAKIL_MUDIR/WADIR_PEND/WADIR_PENGS/KABID/STAF)', key: 'role', width: 44 },
        { header: 'Kode Bidang', key: 'kode_bidang', width: 20 },
        { header: 'Jabatan', key: 'jabatan', width: 30 },
        { header: 'Sub-Bidang / Unit', key: 'sub_bidang', width: 30 },
        { header: 'Boleh Patroli? (YA/TIDAK)', key: 'can_patroli', width: 26 }
      ];

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF065F46' } // Emerald Dark Green
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 28;

      sheet.addRow({
        nama: 'Ahmad Muzakki, S.Pd',
        email: 'ahmad.muzakki@thobari.sch.id',
        password: 'password123',
        role: 'STAF',
        kode_bidang: 'ITMED',
        jabatan: 'Staf Dokumentasi & Media',
        sub_bidang: 'Publikasi Digital',
        can_patroli: 'TIDAK'
      });

      sheet.dataValidations.add('D2:D1000', {
        type: 'list',
        allowBlank: false,
        formulae: ['"MUDIR,WAKIL_MUDIR,WADIR_PEND,WADIR_PENGS,KABID,STAF"']
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="template_karyawan.xlsx"');
      await workbook.xlsx.write(res);
      return res.end();

    } else if (type === 'bidang') {
      const sheet = workbook.addWorksheet('Template Bidang');
      sheet.columns = [
        { header: 'Kode Bidang', key: 'kode_bidang', width: 22 },
        { header: 'Nama Bidang', key: 'nama_bidang', width: 35 },
        { header: 'Deskripsi / Sub-Divisi', key: 'deskripsi', width: 50 },
        { header: 'Cabang (WADIR_PEND/WADIR_PENGS)', key: 'parent_role', width: 34 }
      ];

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4338CA' } // Indigo
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 28;

      sheet.addRow({
        kode_bidang: 'HUMAS',
        nama_bidang: 'Hubungan Masyarakat & Kemitraan',
        deskripsi: 'Pengelolaan relasi wali santri, lembaga mitra, dan donatur',
        parent_role: 'WADIR_PENGS'
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="template_bidang.xlsx"');
      await workbook.xlsx.write(res);
      return res.end();

    } else {
      return res.status(400).json({ success: false, message: 'Jenis template tidak valid. Gunakan: tugas, karyawan, atau bidang.' });
    }
  } catch (error) {
    console.error('Download template error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengunduh template: ' + error.message });
  }
}

// POST /api/import/tasks
async function importTasks(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Berkas Excel wajib diunggah.' });
    }

    const { role, id: creatorId, bidang_id: creatorBidangId } = req.user;
    if (role === 'STAF') {
      return res.status(403).json({ success: false, message: 'Staf tidak memiliki izin untuk mengimpor tugas.' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ success: false, message: 'Lembar kerja Excel kosong.' });
    }

    const db = getPool();
    let importedCount = 0;
    const errors = [];

    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header
        const judul = row.getCell(1).text?.trim();
        const deskripsi = row.getCell(2).text?.trim();
        const periodeRaw = row.getCell(3).text?.trim().toUpperCase();
        const emailAssignee = row.getCell(4).text?.trim().toLowerCase();
        const prioritasRaw = row.getCell(5).text?.trim().toUpperCase();
        const dueDateRaw = row.getCell(6).text?.trim();
        const budgetRaw = row.getCell(7).text?.trim();
        const spentRaw = row.getCell(8).text?.trim();
        const recurringRaw = row.getCell(9).text?.trim().toUpperCase();
        const liburRaw = row.getCell(10).text?.trim();

        if (judul && emailAssignee) {
          rows.push({
            rowNumber,
            judul,
            deskripsi,
            periodeRaw,
            emailAssignee,
            prioritasRaw,
            dueDateRaw,
            budgetRaw,
            spentRaw,
            recurringRaw,
            liburRaw
          });
        }
      }
    });

    for (const item of rows) {
      try {
        // Find assignee
        const [users] = await db.query(
          'SELECT u.id, u.role, u.bidang_id, b.parent_role FROM users u LEFT JOIN bidang b ON b.id = u.bidang_id WHERE u.email = ? LIMIT 1',
          [item.emailAssignee]
        );

        if (users.length === 0) {
          errors.push(`Baris ${item.rowNumber}: Email penerima "${item.emailAssignee}" tidak ditemukan.`);
          continue;
        }
        const assignee = users[0];

        // RBAC validation
        if (role === 'KABID' && (assignee.role !== 'STAF' || assignee.bidang_id !== creatorBidangId)) {
          errors.push(`Baris ${item.rowNumber}: Kabid hanya dapat menugaskan kepada staf di bidangnya sendiri.`);
          continue;
        } else if (role === 'WADIR_PEND' || role === 'WADIR_PENGS') {
          if (assignee.role !== 'KABID' || assignee.parent_role !== role) {
            errors.push(`Baris ${item.rowNumber}: Wadir hanya dapat menugaskan kepada Kabid di bawah cabangnya.`);
            continue;
          }
        } else if (role === 'WAKIL_MUDIR') {
          errors.push(`Baris ${item.rowNumber}: Role Wakil Mudir lama tidak memiliki cabang. Gunakan WADIR_PEND atau WADIR_PENGS.`);
          continue;
        }

        // Validate Period
        let periode = 'HARIAN';
        if (['HARIAN', 'PEKANAN', 'BULANAN', 'TAHUNAN', 'INSIDENTAL'].includes(item.periodeRaw)) {
          periode = item.periodeRaw;
        }

        // Validate Priority
        let prioritas = 'SEDANG';
        if (['RENDAH', 'SEDANG', 'TINGGI', 'URGEN'].includes(item.prioritasRaw)) {
          prioritas = item.prioritasRaw;
        }

        // Validate Due Date
        let dueDate = new Date();
        if (item.dueDateRaw) {
          const parsed = new Date(item.dueDateRaw);
          if (!isNaN(parsed.getTime())) {
            dueDate = parsed;
          } else {
            dueDate.setDate(dueDate.getDate() + 3);
          }
        } else {
          dueDate.setDate(dueDate.getDate() + 3);
        }

        const targetBidangId = assignee.bidang_id || creatorBidangId || 1;
        const budget = Number(item.budgetRaw);
        const spent = Number(item.spentRaw || 0);
        if (item.budgetRaw === '' || !Number.isFinite(budget) || budget < 0 || !Number.isFinite(spent) || spent < 0 || spent > budget) {
          errors.push(`Baris ${item.rowNumber}: Anggaran dana wajib berupa angka >= 0 dan anggaran terpakai tidak boleh melebihinya.`);
          continue;
        }
        if ((role === 'WADIR_PEND' || role === 'WADIR_PENGS') && assignee.parent_role !== role) {
          errors.push(`Baris ${item.rowNumber}: Bidang tugas harus berada di cabang Wadir.`);
          continue;
        }
        const isRecurring = ['HARIAN', 'PEKANAN', 'BULANAN'].includes(periode)
          ? (item.recurringRaw ? (['YA', 'Y', 'YES', '1', 'TRUE'].includes(item.recurringRaw) ? 1 : 0) : 1)
          : 0;

        let holidayExclusions = [];
        if (item.liburRaw) {
          try {
            holidayExclusions = parseHolidayExclusions(item.liburRaw);
          } catch (holidayError) {
            errors.push(`Baris ${item.rowNumber}: ${holidayError.message}`);
            continue;
          }
        }
        const holidayExclusionsJson = JSON.stringify(holidayExclusions);

        const [existingTasks] = await db.query(
          'SELECT id FROM tasks WHERE judul = ? AND assigned_to = ? AND due_date = ? LIMIT 1',
          [item.judul, assignee.id, dueDate]
        );
        if (existingTasks.length > 0) {
          await db.query(
            `UPDATE tasks SET deskripsi = ?, periode = ?, prioritas = ?, bidang_id = ?, anggaran_dana = ?, anggaran_terpakai = ?, is_recurring = ?, libur_pengecualian = ? WHERE id = ?`,
            [item.deskripsi || null, periode, prioritas, targetBidangId, budget, spent, isRecurring, holidayExclusionsJson, existingTasks[0].id]
          );
        } else {
          await db.query(
            `INSERT INTO tasks (
            judul, deskripsi, periode, kategori, prioritas, status,
            created_by, assigned_to, bidang_id, due_date, anggaran_dana, anggaran_terpakai, is_recurring, libur_pengecualian
          ) VALUES (?, ?, ?, 'RUTIN', ?, 'TO_DO', ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
            item.judul,
            item.deskripsi || null,
            periode,
            prioritas,
            creatorId,
            assignee.id,
            targetBidangId,
            dueDate,
            budget,
            spent,
            isRecurring,
            holidayExclusionsJson
            ]
          );
        }

        importedCount++;
      } catch (err) {
        errors.push(`Baris ${item.rowNumber}: ${err.message}`);
      }
    }

    return res.json({
      success: true,
      message: `Berhasil mengimpor ${importedCount} tugas dari total ${rows.length} baris.`,
      importedCount,
      errors
    });
  } catch (error) {
    console.error('Import tasks error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memproses file import tugas: ' + error.message });
  }
}

// POST /api/import/karyawan
async function importKaryawan(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Berkas Excel wajib diunggah.' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ success: false, message: 'Lembar kerja Excel kosong.' });
    }

    const db = getPool();
    let importedCount = 0;
    const errors = [];

    // Preload bidang dictionary
    const [bidangRows] = await db.query('SELECT id, kode_bidang FROM bidang');
    const bidangMap = {};
    bidangRows.forEach(b => {
      bidangMap[b.kode_bidang.toUpperCase()] = b.id;
    });

    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const nama = row.getCell(1).text?.trim();
        const email = row.getCell(2).text?.trim().toLowerCase();
        const password = row.getCell(3).text?.trim() || 'password123';
        const role = row.getCell(4).text?.trim().toUpperCase();
        const kodeBidang = row.getCell(5).text?.trim().toUpperCase();
        const jabatan = row.getCell(6).text?.trim();
        const subBidang = row.getCell(7).text?.trim();
        const canPatroliRaw = row.getCell(8).text?.trim().toUpperCase();

        if (nama && email && role) {
          rows.push({ rowNumber, nama, email, password, role, kodeBidang, jabatan, subBidang, canPatroliRaw });
        }
      }
    });

    for (const item of rows) {
      try {
        const validRoles = ['SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS', 'KABID', 'STAF'];
        if (!validRoles.includes(item.role)) {
          errors.push(`Baris ${item.rowNumber}: Role "${item.role}" tidak valid.`);
          continue;
        }

        const bidangId = item.kodeBidang && bidangMap[item.kodeBidang] ? bidangMap[item.kodeBidang] : null;
        const canPatroli = ['YA', 'Y', 'YES', '1', 'TRUE'].includes(item.canPatroliRaw) ? 1 : 0;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(item.password, salt);

        // Check if exists
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [item.email]);
        if (existing.length > 0) {
          // Update existing
          await db.query(
            `UPDATE users SET nama = ?, role = ?, bidang_id = ?, jabatan = ?, sub_bidang = ?, can_patroli = ? WHERE id = ?`,
            [item.nama, item.role, bidangId, item.jabatan || null, item.subBidang || null, canPatroli, existing[0].id]
          );
        } else {
          // Insert new
          await db.query(
            `INSERT INTO users (nama, email, password, role, bidang_id, jabatan, sub_bidang, can_patroli) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [item.nama, item.email, hashedPassword, item.role, bidangId, item.jabatan || null, item.subBidang || null, canPatroli]
          );
        }
        importedCount++;
      } catch (err) {
        errors.push(`Baris ${item.rowNumber}: ${err.message}`);
      }
    }

    return res.json({
      success: true,
      message: `Berhasil memproses ${importedCount} data karyawan.`,
      importedCount,
      errors
    });
  } catch (error) {
    console.error('Import karyawan error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memproses import karyawan: ' + error.message });
  }
}

// POST /api/import/bidang
async function importBidang(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Berkas Excel wajib diunggah.' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ success: false, message: 'Lembar kerja Excel kosong.' });
    }

    const db = getPool();
    let importedCount = 0;
    const errors = [];

    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const kode_bidang = row.getCell(1).text?.trim().toUpperCase();
        const nama_bidang = row.getCell(2).text?.trim();
        const deskripsi = row.getCell(3).text?.trim();
        const parent_role = row.getCell(4).text?.trim().toUpperCase();

        if (kode_bidang && nama_bidang) {
          rows.push({ rowNumber, kode_bidang, nama_bidang, deskripsi, parent_role });
        }
      }
    });

    for (const item of rows) {
      try {
        const [existing] = await db.query('SELECT id FROM bidang WHERE kode_bidang = ?', [item.kode_bidang]);
        if (existing.length > 0) {
          await db.query(
            'UPDATE bidang SET nama_bidang = ?, deskripsi = ?, parent_role = ? WHERE id = ?',
            [item.nama_bidang, item.deskripsi || null, ['WADIR_PEND', 'WADIR_PENGS'].includes(item.parent_role) ? item.parent_role : null, existing[0].id]
          );
        } else {
          await db.query(
            'INSERT INTO bidang (kode_bidang, nama_bidang, deskripsi, parent_role) VALUES (?, ?, ?, ?)',
            [item.kode_bidang, item.nama_bidang, item.deskripsi || null, ['WADIR_PEND', 'WADIR_PENGS'].includes(item.parent_role) ? item.parent_role : null]
          );
        }
        importedCount++;
      } catch (err) {
        errors.push(`Baris ${item.rowNumber}: ${err.message}`);
      }
    }

    return res.json({
      success: true,
      message: `Berhasil memproses ${importedCount} data bidang.`,
      importedCount,
      errors
    });
  } catch (error) {
    console.error('Import bidang error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memproses import bidang: ' + error.message });
  }
}

module.exports = {
  downloadTemplate,
  importTasks,
  importKaryawan,
  importBidang
};
