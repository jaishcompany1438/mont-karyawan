const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'monitoring',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10000)
};

let pool = null;
let isConnected = false;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

async function initDB() {
  try {
    // Attempt connecting without specifying database to create it if needed
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port,
      connectTimeout: dbConfig.connectTimeout
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.end();

    const db = getPool();

    // 1. Tabel Bidang / Struktur Organisasi
    await db.query(`
      CREATE TABLE IF NOT EXISTS bidang (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_bidang VARCHAR(100) NOT NULL,
        kode_bidang VARCHAR(20) UNIQUE NOT NULL,
        deskripsi TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Tabel Users (Karyawan & Pimpinan)
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(150) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS', 'KABID', 'STAF') NOT NULL,
        bidang_id INT NULL,
        jabatan VARCHAR(100) NULL,
        sub_bidang VARCHAR(100) NULL,
        no_telepon VARCHAR(30) NULL,
        can_patroli TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bidang_id) REFERENCES bidang(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. Tabel Tugas (Tasks)
    await db.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        judul VARCHAR(255) NOT NULL,
        deskripsi TEXT NULL,
        parent_role ENUM('WADIR_PEND', 'WADIR_PENGS') NULL,
        periode ENUM('HARIAN', 'PEKANAN', 'BULANAN', 'TAHUNAN', 'INSIDENTAL') NOT NULL DEFAULT 'HARIAN',
        kategori ENUM('RUTIN', 'PROYEK', 'MENDADAK') DEFAULT 'RUTIN',
        prioritas ENUM('RENDAH', 'SEDANG', 'TINGGI', 'URGEN') DEFAULT 'SEDANG',
        status ENUM('TO_DO', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'REVISION') DEFAULT 'TO_DO',
        created_by INT NOT NULL,
        assigned_to INT NOT NULL,
        bidang_id INT NOT NULL,
        due_date DATETIME NOT NULL,
        anggaran_dana DECIMAL(15,2) NOT NULL DEFAULT 0,
        anggaran_terpakai DECIMAL(15,2) NOT NULL DEFAULT 0,
        is_recurring TINYINT(1) NOT NULL DEFAULT 0,
        recurrence_parent_id INT NULL,
        recurrence_generated_at DATETIME NULL,
        file_attachment VARCHAR(255) NULL,
        kendala TEXT NULL,
        solusi TEXT NULL,
        started_by INT NULL,
        started_at DATETIME NULL,
        completed_by INT NULL,
        completed_at DATETIME NULL,
        bukti_kerja VARCHAR(255) NULL,
        catatan_revisi TEXT NULL,
        catatan_reviewer TEXT NULL,
        nilai_sop DECIMAL(3,1) NULL,
        nilai_waktu DECIMAL(3,1) NULL,
        nilai_kualitas DECIMAL(3,1) NULL,
        libur_pengecualian TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id),
        FOREIGN KEY (bidang_id) REFERENCES bidang(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Tabel Pengajuan Tugas Lintas Bidang
    await db.query(`
      CREATE TABLE IF NOT EXISTS cross_department_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        judul VARCHAR(255) NOT NULL,
        deskripsi TEXT NOT NULL,
        urgensi ENUM('RENDAH', 'SEDANG', 'TINGGI', 'URGEN') NOT NULL DEFAULT 'SEDANG',
        due_date DATETIME NOT NULL,
        file_attachment VARCHAR(255) NULL,
        status ENUM('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
        catatan_tanggapan TEXT NULL,
        from_user_id INT NOT NULL,
        from_bidang_id INT NULL,
        target_bidang_id INT NOT NULL,
        converted_task_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (from_bidang_id) REFERENCES bidang(id) ON DELETE SET NULL,
        FOREIGN KEY (target_bidang_id) REFERENCES bidang(id) ON DELETE CASCADE,
        FOREIGN KEY (converted_task_id) REFERENCES tasks(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Tabel Notifikasi
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        judul VARCHAR(255) NOT NULL,
        pesan TEXT NOT NULL,
        tipe ENUM(
          'PERINTAH_ATASAN',
          'REVISI_PEKERJAAN',
          'PENGAJUAN_LINTAS_BIDANG',
          'REVIEW_PEKERJAAN',
          'INFO'
        ) NOT NULL DEFAULT 'INFO',
        reference_id INT NULL,
        reference_type VARCHAR(50) NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);


    // Lightweight migrations for installations created before recurring tasks
    // and staff sub-bidang support were introduced.
    const migrations = [
      ['bidang', 'parent_role', "ALTER TABLE bidang ADD COLUMN parent_role ENUM('WADIR_PEND','WADIR_PENGS') NULL AFTER deskripsi"],
      ['users', 'sub_bidang', 'ALTER TABLE users ADD COLUMN sub_bidang VARCHAR(100) NULL AFTER jabatan'],
      ['tasks', 'parent_role', "ALTER TABLE tasks ADD COLUMN parent_role ENUM('WADIR_PEND','WADIR_PENGS') NULL AFTER deskripsi"],
      ['tasks', 'is_recurring', 'ALTER TABLE tasks ADD COLUMN is_recurring TINYINT(1) NOT NULL DEFAULT 0 AFTER due_date'],
      ['tasks', 'recurrence_parent_id', 'ALTER TABLE tasks ADD COLUMN recurrence_parent_id INT NULL AFTER is_recurring'],
      ['tasks', 'recurrence_generated_at', 'ALTER TABLE tasks ADD COLUMN recurrence_generated_at DATETIME NULL AFTER recurrence_parent_id'],
      ['users', 'no_telepon', 'ALTER TABLE users ADD COLUMN no_telepon VARCHAR(30) NULL AFTER sub_bidang'],
      ['tasks', 'anggaran_dana', 'ALTER TABLE tasks ADD COLUMN anggaran_dana DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER due_date'],
      ['tasks', 'anggaran_terpakai', 'ALTER TABLE tasks ADD COLUMN anggaran_terpakai DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER anggaran_dana'],
      ['tasks', 'catatan_reviewer', 'ALTER TABLE tasks ADD COLUMN catatan_reviewer TEXT NULL AFTER catatan_revisi'],
      ['tasks', 'nilai_sop', 'ALTER TABLE tasks ADD COLUMN nilai_sop DECIMAL(3,1) NULL AFTER catatan_reviewer'],
      ['tasks', 'nilai_waktu', 'ALTER TABLE tasks ADD COLUMN nilai_waktu DECIMAL(3,1) NULL AFTER nilai_sop'],
      ['tasks', 'nilai_kualitas', 'ALTER TABLE tasks ADD COLUMN nilai_kualitas DECIMAL(3,1) NULL AFTER nilai_waktu'],
      ['tasks', 'libur_pengecualian', 'ALTER TABLE tasks ADD COLUMN libur_pengecualian TEXT NULL AFTER nilai_kualitas']
      ,['tasks', 'kendala', 'ALTER TABLE tasks ADD COLUMN kendala TEXT NULL AFTER file_attachment']
      ,['tasks', 'solusi', 'ALTER TABLE tasks ADD COLUMN solusi TEXT NULL AFTER kendala']
      ,['tasks', 'started_by', 'ALTER TABLE tasks ADD COLUMN started_by INT NULL AFTER solusi']
      ,['tasks', 'started_at', 'ALTER TABLE tasks ADD COLUMN started_at DATETIME NULL AFTER started_by']
      ,['tasks', 'completed_by', 'ALTER TABLE tasks ADD COLUMN completed_by INT NULL AFTER started_at']
      ,['tasks', 'completed_at', 'ALTER TABLE tasks ADD COLUMN completed_at DATETIME NULL AFTER completed_by']
      ,['users', 'can_patroli', 'ALTER TABLE users ADD COLUMN can_patroli TINYINT(1) NOT NULL DEFAULT 0 AFTER no_telepon']
    ];
    for (const [table, column, statement] of migrations) {
      const [columns] = await db.query(
        `SELECT COUNT(*) AS present FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [table, column]
      );
      if (!columns[0].present) await db.query(statement);
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS patroli_ruangan (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_ruangan VARCHAR(150) NOT NULL UNIQUE,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS patroli (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        ruangan VARCHAR(150) NOT NULL,
        tanggal DATE NOT NULL,
        nilai_kebersihan VARCHAR(20) NOT NULL,
        nilai_kerapihan VARCHAR(20) NOT NULL,
        nilai_sarpras VARCHAR(20) NOT NULL,
        nilai_ketertiban VARCHAR(20) NOT NULL,
        skor_kebersihan DECIMAL(2,1) NOT NULL DEFAULT 0,
        skor_kerapihan DECIMAL(2,1) NOT NULL DEFAULT 0,
        skor_sarpras DECIMAL(2,1) NOT NULL DEFAULT 0,
        skor_ketertiban DECIMAL(2,1) NOT NULL DEFAULT 0,
        catatan_temuan TEXT NULL,
        foto_bukti VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_patroli_tanggal (tanggal),
        INDEX idx_patroli_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    const patrolMigrations = [
      ['skor_kebersihan', 'ALTER TABLE patroli ADD COLUMN skor_kebersihan DECIMAL(2,1) NOT NULL DEFAULT 0 AFTER nilai_ketertiban'],
      ['skor_kerapihan', 'ALTER TABLE patroli ADD COLUMN skor_kerapihan DECIMAL(2,1) NOT NULL DEFAULT 0 AFTER skor_kebersihan'],
      ['skor_sarpras', 'ALTER TABLE patroli ADD COLUMN skor_sarpras DECIMAL(2,1) NOT NULL DEFAULT 0 AFTER skor_kerapihan'],
      ['skor_ketertiban', 'ALTER TABLE patroli ADD COLUMN skor_ketertiban DECIMAL(2,1) NOT NULL DEFAULT 0 AFTER skor_sarpras']
    ];
    for (const [column, statement] of patrolMigrations) {
      const [columns] = await db.query(
        `SELECT COUNT(*) AS present FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'patroli' AND column_name = ?`,
        [column]
      );
      if (!columns[0].present) await db.query(statement);
    }

    // Auto-migration for cross_department_requests from_bidang_id to be nullable
    try {
      const [crossTableCol] = await db.query(
        `SELECT IS_NULLABLE FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'cross_department_requests' AND column_name = 'from_bidang_id'`
      );
      if (crossTableCol.length > 0 && crossTableCol[0].IS_NULLABLE === 'NO') {
        const [fks] = await db.query(`
          SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE 
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cross_department_requests' AND COLUMN_NAME = 'from_bidang_id' AND REFERENCED_TABLE_NAME = 'bidang'
        `);
        for (const fk of fks) {
          try {
            await db.query(`ALTER TABLE cross_department_requests DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
          } catch (e) {}
        }
        await db.query(`ALTER TABLE cross_department_requests MODIFY COLUMN from_bidang_id INT NULL`);
        try {
          await db.query(`ALTER TABLE cross_department_requests ADD CONSTRAINT fk_cdr_from_bidang FOREIGN KEY (from_bidang_id) REFERENCES bidang(id) ON DELETE SET NULL`);
        } catch (e) {}
      }
    } catch (err) {
      console.warn('[Migration cross_department_requests]:', err.message);
    }

    // ALTER ENUMs rather than recreating users, preserving all existing data.
    await db.query("ALTER TABLE users MODIFY COLUMN role ENUM('SUPER_ADMIN','MUDIR','WAKIL_MUDIR','WADIR_PEND','WADIR_PENGS','KABID','STAF') NOT NULL");
    await db.query("ALTER TABLE tasks MODIFY COLUMN periode ENUM('HARIAN','PEKANAN','BULANAN','TAHUNAN','INSIDENTAL') NOT NULL DEFAULT 'HARIAN'");
    // A period is the recurrence declaration for legacy periodic tasks.
    await db.query(`UPDATE tasks SET is_recurring = 1 WHERE periode IN ('HARIAN', 'PEKANAN', 'BULANAN') AND is_recurring = 0`);

    isConnected = true;
    console.log(`[Database] Connected successfully to MySQL database "${dbConfig.database}"`);
  } catch (error) {
    console.warn(`[Database Warning] Could not connect to MySQL server at ${dbConfig.host}:${dbConfig.port}: ${error.message}`);
    console.warn('[Database Warning] Make sure MySQL is running or configure credentials in .env.');
    isConnected = false;
  }

}

function addPeriod(date, periode) {
    const next = new Date(date);
    if (periode === 'HARIAN') next.setDate(next.getDate() + 1);
    if (periode === 'PEKANAN') next.setDate(next.getDate() + 7);
    if (periode === 'BULANAN') next.setMonth(next.getMonth() + 1);
    return next;
  }

function isHoliday(date, exclusions) {
  let values = [];
  try {
    values = Array.isArray(exclusions) ? exclusions : JSON.parse(exclusions || '[]');
  } catch (error) {
    console.warn('[Recurring task holidays] Invalid exclusion configuration:', error.message);
  }
  if (!Array.isArray(values)) return false;
  const dateKey = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
  const weekday = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][date.getDay()];
  return values.includes(dateKey) || values.map((value) => String(value).toUpperCase()).includes(weekday);
}

  // Creates one next instance per due periodic task. The source is marked in the
  // same transaction so repeated scheduler runs cannot duplicate an instance.
async function generateDueRecurringTasks() {
    if (!isConnected || !pool) return 0;
    const connection = await pool.getConnection();
    let generated = 0;
    try {
      await connection.beginTransaction();
      const [dueTasks] = await connection.query(`
        SELECT * FROM tasks
        WHERE is_recurring = 1
          AND periode IN ('HARIAN', 'PEKANAN', 'BULANAN')
          AND due_date <= NOW()
          AND recurrence_generated_at IS NULL
        ORDER BY due_date ASC
        FOR UPDATE
      `);
      for (const task of dueTasks) {
        let nextDue = addPeriod(task.due_date, task.periode);
        // Advance past every configured holiday so a scheduler run never creates
        // an instance on an excluded date.
        while (isHoliday(nextDue, task.libur_pengecualian)) {
          nextDue = addPeriod(nextDue, task.periode);
        }
        const [result] = await connection.query(`
          INSERT INTO tasks (
            judul, deskripsi, periode, kategori, prioritas, status,
            created_by, assigned_to, bidang_id, due_date, anggaran_dana, anggaran_terpakai, file_attachment,
            is_recurring, recurrence_parent_id, libur_pengecualian
          ) VALUES (?, ?, ?, ?, ?, 'TO_DO', ?, ?, ?, ?, ?, 0, ?, 1, ?, ?)
        `, [
          task.judul, task.deskripsi, task.periode, task.kategori, task.prioritas,
          task.created_by, task.assigned_to, task.bidang_id, nextDue,
          task.anggaran_dana,
          task.file_attachment, task.recurrence_parent_id || task.id, task.libur_pengecualian
        ]);
        await connection.query(
          'UPDATE tasks SET recurrence_generated_at = NOW() WHERE id = ?',
          [task.id]
        );
        generated += result.affectedRows;
      }
      await connection.commit();
      return generated;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
  }
}

module.exports = {
  getPool,
  initDB,
  generateDueRecurringTasks,
  isDbConnected: () => isConnected
};
