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
        role ENUM('SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR', 'KABID', 'STAF') NOT NULL,
        bidang_id INT NULL,
        jabatan VARCHAR(100) NULL,
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
        periode ENUM('HARIAN', 'PEKANAN', 'BULANAN', 'TAHUNAN') NOT NULL DEFAULT 'HARIAN',
        kategori ENUM('RUTIN', 'PROYEK', 'MENDADAK') DEFAULT 'RUTIN',
        prioritas ENUM('RENDAH', 'SEDANG', 'TINGGI', 'URGEN') DEFAULT 'SEDANG',
        status ENUM('TO_DO', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'REVISION') DEFAULT 'TO_DO',
        created_by INT NOT NULL,
        assigned_to INT NOT NULL,
        bidang_id INT NOT NULL,
        due_date DATETIME NOT NULL,
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

    isConnected = true;
    console.log(`[Database] Connected successfully to MySQL database "${dbConfig.database}"`);
  } catch (error) {
    console.warn(`[Database Warning] Could not connect to MySQL server at ${dbConfig.host}:${dbConfig.port}: ${error.message}`);
    console.warn('[Database Warning] Make sure MySQL is running or configure credentials in .env.');
    isConnected = false;
  }
}

module.exports = {
  getPool,
  initDB,
  isDbConnected: () => isConnected
};
