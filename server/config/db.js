const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mon_karyawan',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
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
      port: dbConfig.port
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
        periode ENUM('HARIAN', 'PEKANAN', 'BULANAN', 'TAHUNAN') NOT NULL DEFAULT 'HARIAN',
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
        bukti_kerja VARCHAR(255) NULL,
        catatan_revisi TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id),
        FOREIGN KEY (bidang_id) REFERENCES bidang(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Lightweight migrations for installations created before recurring tasks
    // and staff sub-bidang support were introduced.
    const migrations = [
      ['bidang', 'parent_role', "ALTER TABLE bidang ADD COLUMN parent_role ENUM('WADIR_PEND','WADIR_PENGS') NULL AFTER deskripsi"],
      ['users', 'sub_bidang', 'ALTER TABLE users ADD COLUMN sub_bidang VARCHAR(100) NULL AFTER jabatan'],
      ['tasks', 'is_recurring', 'ALTER TABLE tasks ADD COLUMN is_recurring TINYINT(1) NOT NULL DEFAULT 0 AFTER due_date'],
      ['tasks', 'recurrence_parent_id', 'ALTER TABLE tasks ADD COLUMN recurrence_parent_id INT NULL AFTER is_recurring'],
      ['tasks', 'recurrence_generated_at', 'ALTER TABLE tasks ADD COLUMN recurrence_generated_at DATETIME NULL AFTER recurrence_parent_id']
      ,['users', 'no_telepon', 'ALTER TABLE users ADD COLUMN no_telepon VARCHAR(30) NULL AFTER sub_bidang']
      ,['tasks', 'anggaran_dana', 'ALTER TABLE tasks ADD COLUMN anggaran_dana DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER due_date']
      ,['tasks', 'anggaran_terpakai', 'ALTER TABLE tasks ADD COLUMN anggaran_terpakai DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER anggaran_dana']
    ];
    for (const [table, column, statement] of migrations) {
      const [columns] = await db.query(
        `SELECT COUNT(*) AS present FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [table, column]
      );
      if (!columns[0].present) await db.query(statement);
    }
    // ALTER ENUMs rather than recreating users, preserving all existing data.
    await db.query("ALTER TABLE users MODIFY COLUMN role ENUM('SUPER_ADMIN','MUDIR','WAKIL_MUDIR','WADIR_PEND','WADIR_PENGS','KABID','STAF') NOT NULL");
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
        const nextDue = addPeriod(task.due_date, task.periode);
        const [result] = await connection.query(`
          INSERT INTO tasks (
            judul, deskripsi, periode, kategori, prioritas, status,
            created_by, assigned_to, bidang_id, due_date, anggaran_dana, anggaran_terpakai, file_attachment,
            is_recurring, recurrence_parent_id
          ) VALUES (?, ?, ?, ?, ?, 'TO_DO', ?, ?, ?, ?, ?, 0, ?, 1, ?)
        `, [
          task.judul, task.deskripsi, task.periode, task.kategori, task.prioritas,
          task.created_by, task.assigned_to, task.bidang_id, nextDue,
          task.anggaran_dana,
          task.file_attachment, task.recurrence_parent_id || task.id
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
