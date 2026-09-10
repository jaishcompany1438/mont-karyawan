const bcrypt = require('bcryptjs');
const { getPool, initDB, isDbConnected } = require('./db');

async function seedData() {
  await initDB();
  if (!isDbConnected()) {
    console.log('[Seed] Database is not connected. Skipping seeder.');
    return;
  }

  const db = getPool();
  try {
    // Check if data already exists
    const [existingUsers] = await db.query('SELECT COUNT(*) as count FROM users');
    if (existingUsers[0].count > 0) {
      console.log('[Seed] Users table is already populated.');
      return;
    }

    console.log('[Seed] Seeding default departments, users, and tasks...');

    // 1. Insert Bidang
    const [itRes] = await db.query(
      'INSERT INTO bidang (nama_bidang, kode_bidang, deskripsi) VALUES (?, ?, ?)',
      ['Teknologi Informasi & Media', 'ITMED', 'Pengelolaan sistem web, jaringan, dan media publikasi']
    );
    const [kurikRes] = await db.query(
      'INSERT INTO bidang (nama_bidang, kode_bidang, deskripsi) VALUES (?, ?, ?)',
      ['Kurikulum & Pendidikan', 'KURIK', 'Pengelolaan kurikulum tahfizh dan pendidikan santri']
    );
    const [kesanRes] = await db.query(
      'INSERT INTO bidang (nama_bidang, kode_bidang, deskripsi) VALUES (?, ?, ?)',
      ['Kesantrian & Asrama', 'KESAN', 'Pengawasan tata tertib, kedisiplinan, dan asrama']
    );
    const [sarprasRes] = await db.query(
      'INSERT INTO bidang (nama_bidang, kode_bidang, deskripsi) VALUES (?, ?, ?)',
      ['Keuangan & Sarana Prasarana', 'SARPRAS', 'Keuangan lembaga, pengadaan, dan pemeliharaan fasilitas']
    );

    const itId = itRes.insertId;
    const kurikId = kurikRes.insertId;
    const kesanId = kesanRes.insertId;
    const sarprasId = sarprasRes.insertId;
    await db.query("UPDATE bidang SET parent_role = CASE kode_bidang WHEN 'KURIK' THEN 'WADIR_PEND' WHEN 'KESAN' THEN 'WADIR_PENGS' ELSE NULL END WHERE id IN (?, ?, ?, ?)", [itId, kurikId, kesanId, sarprasId]);

    // Hash passwords
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash('admin123', salt);
    const mudirPassword = await bcrypt.hash('mudir123', salt);
    const wadirPendPassword = await bcrypt.hash('wadirpend123', salt);
    const wadirPengsPassword = await bcrypt.hash('wadirpengs123', salt);
    const kabidPassword = await bcrypt.hash('kabid123', salt);
    const stafPassword = await bcrypt.hash('staf123', salt);

    // 2. Insert Users
    const [adminUser] = await db.query(
      'INSERT INTO users (nama, email, password, role, bidang_id, jabatan) VALUES (?, ?, ?, ?, ?, ?)',
      ['Super Administrator', 'admin@thobari.sch.id', defaultPassword, 'SUPER_ADMIN', itId, 'IT Administrator']
    );

    const [mudirUser] = await db.query(
      'INSERT INTO users (nama, email, password, role, bidang_id, jabatan) VALUES (?, ?, ?, ?, ?, ?)',
      ['Ustadz Pimpinan Mudir', 'mudir@thobari.sch.id', mudirPassword, 'MUDIR', null, 'Mudir Pesantren']
    );

    await db.query(
      'INSERT INTO users (nama, email, password, role, bidang_id, jabatan) VALUES (?, ?, ?, ?, ?, ?)',
      ['Ustadz Wadir Pendidikan', 'wadir.pendidikan@thobari.sch.id', wadirPendPassword, 'WADIR_PEND', null, 'Wakil Mudir Pendidikan']
    );

    await db.query(
      'INSERT INTO users (nama, email, password, role, bidang_id, jabatan) VALUES (?, ?, ?, ?, ?, ?)',
      ['Ustadz Wadir Pengasuhan', 'wadir.pengasuhan@thobari.sch.id', wadirPengsPassword, 'WADIR_PENGS', null, 'Wakil Mudir Pengasuhan']
    );

    const [kabidItUser] = await db.query(
      'INSERT INTO users (nama, email, password, role, bidang_id, jabatan) VALUES (?, ?, ?, ?, ?, ?)',
      ['Ahmad Fauzi, S.Kom', 'kabid.it@thobari.sch.id', kabidPassword, 'KABID', itId, 'Kepala Bidang IT & Media']
    );

    const [stafItUser] = await db.query(
      'INSERT INTO users (nama, email, password, role, bidang_id, jabatan) VALUES (?, ?, ?, ?, ?, ?)',
      ['Budi Santoso', 'staf.it@thobari.sch.id', stafPassword, 'STAF', itId, 'Staf Web Developer & Support']
    );

    const [kabidKurikUser] = await db.query(
      'INSERT INTO users (nama, email, password, role, bidang_id, jabatan) VALUES (?, ?, ?, ?, ?, ?)',
      ['Ust. Ridwan, Lc', 'kabid.kurik@thobari.sch.id', kabidPassword, 'KABID', kurikId, 'Kepala Bidang Kurikulum']
    );

    const [stafKurikUser] = await db.query(
      'INSERT INTO users (nama, email, password, role, bidang_id, jabatan) VALUES (?, ?, ?, ?, ?, ?)',
      ['Ust. Farhan', 'staf.kurik@thobari.sch.id', stafPassword, 'STAF', kurikId, 'Staf Administrasi Pendidikan']
    );

    // 3. Insert Initial Tasks across periods
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    // Harian
    await db.query(
      `INSERT INTO tasks (judul, deskripsi, periode, kategori, prioritas, status, created_by, assigned_to, bidang_id, due_date)
       VALUES (?, ?, 'HARIAN', 'RUTIN', 'TINGGI', 'IN_PROGRESS', ?, ?, ?, ?)`,
      [
        'Pengecekan Server & Backup Database Harian',
        'Lakukan backup otomatis snapshot database web monitoring dan server lokal',
        kabidItUser.insertId,
        stafItUser.insertId,
        itId,
        tomorrow
      ]
    );

    // Pekanan
    await db.query(
      `INSERT INTO tasks (judul, deskripsi, periode, kategori, prioritas, status, created_by, assigned_to, bidang_id, due_date)
       VALUES (?, ?, 'PEKANAN', 'RUTIN', 'SEDANG', 'TO_DO', ?, ?, ?, ?)`,
      [
        'Pemeliharaan Jaringan WiFi Pesantren & Absensi Digital',
        'Pastikan access point di gedung asrama dan ruang kelas berfungsi optimal tanpa kendala sinyal',
        kabidItUser.insertId,
        stafItUser.insertId,
        itId,
        nextWeek
      ]
    );

    // Bulanan
    await db.query(
      `INSERT INTO tasks (judul, deskripsi, periode, kategori, prioritas, status, created_by, assigned_to, bidang_id, due_date)
       VALUES (?, ?, 'BULANAN', 'PROYEK', 'URGEN', 'UNDER_REVIEW', ?, ?, ?, ?)`,
      [
        'Rekap Nilai Tahfizh Bulanan & Rapor Santri',
        'Kompilasi setoran hafalan seluruh halaqah dan cetak pratinjau rapor bulanan',
        mudirUser.insertId,
        stafKurikUser.insertId,
        kurikId,
        nextMonth
      ]
    );

    // Tahunan
    await db.query(
      `INSERT INTO tasks (judul, deskripsi, periode, kategori, prioritas, status, created_by, assigned_to, bidang_id, due_date)
       VALUES (?, ?, 'TAHUNAN', 'PROYEK', 'TINGGI', 'TO_DO', ?, ?, ?, ?)`,
      [
        'Penyusunan Rencana Anggaran & Sarpras Tahun Ajaran Baru',
        'Audit inventaris peralatan dan susun proposal belanja fasilitas pendidikan tahun depan',
        mudirUser.insertId,
        wakilUser.insertId,
        sarprasId,
        nextYear
      ]
    );

    console.log('[Seed] Initial data seeded successfully!');
  } catch (error) {
    console.error('[Seed Error]:', error.message);
  }
}

if (require.main === module) {
  seedData().then(() => process.exit(0));
}

module.exports = seedData;
