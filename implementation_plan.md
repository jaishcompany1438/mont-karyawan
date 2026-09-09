# Implementasi Aplikasi Monitoring Pekerjaan Karyawan & Bidang (GitHub Issue #1)

Rencana kerja ini disusun untuk mengimplementasikan secara menyeluruh spesifikasi dari **GitHub Issue #1: Monitoring-Karyawan-PTQIT** pada repositori [jaishcompany1438/mont-karyawan](https://github.com/jaishcompany1438/mont-karyawan/issues/1).

## Ringkasan Proyek & Spesifikasi
Aplikasi web berbasis Fullstack JavaScript (Express.js REST API + React Vite Tailwind + MySQL) yang dirancang untuk Hostinger Business Web Hosting dengan fitur utama:
1. **Sistem RBAC 5 Peran**: `SUPER_ADMIN`, `MUDIR`, `WAKIL_MUDIR`, `KABID`, `STAF`.
2. **Atribut & Periode Tugas**: Klasifikasi tugas wajib dengan periode `HARIAN`, `PEKANAN`, `BULANAN`, `TAHUNAN`, kategori (`RUTIN`, `PROYEK`, `MENDADAK`), prioritas (`RENDAH`, `SEDANG`, `TINGGI`, `URGEN`), dan status (`TO_DO`, `IN_PROGRESS`, `UNDER_REVIEW`, `COMPLETED`, `REVISION`).
3. **Approval & Review Flow**: Penugasan berjenjang, penyerahan bukti kerja oleh staf, verifikasi (Approve/Reject dengan catatan revisi) oleh pemberi tugas.
4. **Modul Excel Lengkap**:
   - Template resmi `.xlsx` berformat valid dengan header terkunci & panduan pengisian untuk: Tugas (`template_tugas.xlsx`), Karyawan (`template_karyawan.xlsx`), Bidang (`template_bidang.xlsx`).
   - Batch import via file Excel untuk ketiga entitas tersebut.
   - Download template resmi langsung via REST API.
5. **Dashboard & Visualisasi**:
   - Kartu statistik metrik per filter periode.
   - Papan Kanban Board interaktif & Tabel View dengan otorisasi tombol sesuai role.
   - Ekspor rekap laporan ke Excel & PDF / Print View.
6. **Integrasi GitHub CLI**:
   - Autentikasi GitHub CLI (`gh`) di komputer pengguna.
   - Pembuatan branch pengerjaan issue, commit rapi, dan sinkronisasi ke repositori GitHub.

---

## User Review Required

> [!IMPORTANT]
> **Autentikasi GitHub CLI di PC Anda:**
> GitHub CLI (`gh.exe`) telah terpasang di `C:\Program Files\GitHub CLI\gh.exe`, dan saat ini sesi autentikasi browser satu kali (one-time device code) sedang menunggu konfirmasi Anda:
> 1. Buka tautan: [https://github.com/login/device](https://github.com/login/device)
> 2. Masukkan kode: **`5858-0659`**
> 3. Klik **Authorize github**.
> Setelah Anda menyetujuinya, GitHub CLI akan langsung terhubung ke akun GitHub Anda.

> [!NOTE]
> **Konfigurasi Database MySQL:**
> Aplikasi akan dikonfigurasi menggunakan `mysql2` dengan pool connection dan skrip auto-migrate DDL tabel sesuai skema PRD. Secara default, koneksi lokal akan membaca file `.env` (misalnya `DB_HOST=localhost`, `DB_USER=root`, `DB_PASSWORD=`, `DB_NAME=mon_karyawan`). Untuk kemudahan pengujian di komputer lokal jika server MySQL lokal belum aktif, kami juga menyediakan seeder data awal dan graceful fallback/dummy support.

---

## Rencana Perubahan & Struktur Proyek

### 1. Struktur Direktori Proyek
```text
mon-karyawan/
├── package.json              # Root package (scripts untuk dev dan build Hostinger)
├── server.js                 # Entry point utama untuk Hostinger hPanel
├── .env.example              # Template variabel lingkungan (DB, JWT_SECRET, PORT)
├── .gitignore                # Ignore node_modules, .env, uploads, build dist
├── server/
│   ├── config/
│   │   ├── db.js             # MySQL connection pool & auto-init tabel DDL
│   │   └── seed.js           # Seeder akun default (Super Admin, Mudir, Wakil Mudir, Kabid, Staf)
│   ├── middleware/
│   │   ├── auth.js           # JWT verification & RBAC check middleware
│   │   └── upload.js         # Multer config untuk file_attachment & bukti_kerja
│   ├── controllers/
│   │   ├── authController.js # Login, Profile, Password hash
│   │   ├── bidangController.js # CRUD Bidang
│   │   ├── userController.js # CRUD Users & RBAC listing
│   │   ├── taskController.js # Task CRUD, status transition, review/approval flow
│   │   ├── excelController.js# Generate template .xlsx resmi & import parser
│   │   └── reportController.js # Statistik agregat & export rekap
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── bidangRoutes.js
│   │   ├── userRoutes.js
│   │   ├── taskRoutes.js
│   │   ├── excelRoutes.js
│   │   └── reportRoutes.js
│   └── uploads/              # Penyimpanan berkas attachment dan bukti kerja
└── client/                   # Frontend React + Vite + Tailwind CSS + Lucide React
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── context/
        │   └── AuthContext.jsx
        ├── services/
        │   └── api.js
        ├── components/
        │   ├── Navbar.jsx
        │   ├── Sidebar.jsx
        │   ├── PeriodTabs.jsx
        │   ├── StatCards.jsx
        │   ├── KanbanBoard.jsx
        │   ├── TaskTable.jsx
        │   ├── TaskModal.jsx
        │   ├── ReviewModal.jsx
        │   ├── ExcelUploadModal.jsx
        │   └── ExportReportModal.jsx
        └── pages/
            ├── Login.jsx
            ├── Dashboard.jsx
            ├── Tasks.jsx
            ├── Departments.jsx
            ├── Users.jsx
            └── Reports.jsx
```

---

### 2. Rincian Endpoint REST API

#### [NEW] Authentication & Users
- `POST /api/auth/login` - Autentikasi dengan email & password, mengembalikan JWT & data profil role.
- `GET /api/auth/me` - Ambil profil pengguna yang sedang login.
- `GET /api/users` - Ambil daftar pengguna (filter by role & bidang untuk dropdown assignee).
- `POST /api/users` - Buat pengguna baru (hanya SUPER_ADMIN).
- `PUT /api/users/:id` - Edit pengguna.
- `DELETE /api/users/:id` - Hapus pengguna.

#### [NEW] Bidang (Departemen / Divisi)
- `GET /api/bidang` - Ambil daftar struktur bidang.
- `POST /api/bidang` - Tambah bidang baru (SUPER_ADMIN).
- `PUT /api/bidang/:id` - Update bidang.
- `DELETE /api/bidang/:id` - Hapus bidang.

#### [NEW] Tasks (Tugas & Monitoring)
- `GET /api/tasks` - Ambil daftar tugas dengan filter query `?periode=HARIAN|PEKANAN|BULANAN|TAHUNAN`, `?status=`, `?bidang_id=`, `?prioritas=`. Dibatasi sesuai RBAC.
- `POST /api/tasks` - Buat tugas baru dengan validasi aturan hirarki:
  - *Mudir*: Bebas menugaskan ke siapa saja.
  - *Wakil Mudir*: Boleh menugaskan ke Kabid dan Staf.
  - *Kabid*: Hanya boleh menugaskan ke Staf di bidangnya sendiri.
- `PUT /api/tasks/:id` - Perbarui detail tugas (hanya pembuat atau admin).
- `POST /api/tasks/:id/submit-review` - Staf mengunggah `bukti_kerja` dan mengubah status ke `UNDER_REVIEW`.
- `POST /api/tasks/:id/review` - Pembuat tugas/Pimpinan melakukan `APPROVE` (status jadi `COMPLETED`) atau `REJECT` (status jadi `REVISION` + `catatan_revisi`).
- `DELETE /api/tasks/:id` - Hapus tugas.

#### [NEW] Excel Engine (Template Streamer & Import Parser)
- `GET /api/templates/download/:type` - Menghasilkan dan mengirimkan berkas template `.xlsx` resmi yang valid:
  - `tugas` -> `template_tugas.xlsx`
  - `karyawan` -> `template_karyawan.xlsx`
  - `bidang` -> `template_bidang.xlsx`
- `POST /api/import/tasks` - Parse berkas Excel tugas batch, validasi email assignee, bidang, dan format tanggal.
- `POST /api/import/karyawan` - Parse dan batch insert/update pengguna.
- `POST /api/import/bidang` - Parse dan batch insert bidang.

#### [NEW] Dashboard & Reports
- `GET /api/reports/dashboard` - Menghitung metrik total tugas, tugas selesai, sedang berjalan, overdue, dan under review dipisahkan per periode filter.
- `GET /api/reports/export/excel` - Download rekap laporan tugas dalam format spreadsheet Excel.

---

### 3. Frontend UI/UX
- **Desain Modern & Responsif**: Menggunakan Tailwind CSS dan Lucide Icons, clean dashboard layout dengan sidebar navigasi.
- **Tab Filter Periode Utama**: `[Semua]` | `[Harian]` | `[Pekanan]` | `[Bulanan]` | `[Tahunan]`.
- **Dua Tampilan Kerja**: Switch antara **Kanban Board** (drag/column view berdasarkan status) dan **Table View** (pencarian, sorting, filter lanjutan).
- **Aksi Cepat & Modal**:
  - Modal buat tugas manual dengan dropdown dinamis sesuai RBAC penerima.
  - Modal Upload Excel dengan tombol langsung "Unduh Template Excel Resmi".
  - Modal Review Pekerjaan untuk pimpinan memeriksa bukti kerja dan memberikan feedback revisi.
  - Halaman Laporan & Rekap Kinerja dengan filter tanggal dan tombol export.

---

### 4. Langkah Git & GitHub CLI
1. Pastikan autentikasi GitHub CLI berhasil (`gh auth status`).
2. Buat branch git baru untuk pengerjaan issue: `git checkout -b feature/monitoring-karyawan-v2`.
3. Buat implementasi menyeluruh backend & frontend.
4. Lakukan pengujian build frontend (`npm run build`) dan startup backend.
5. Commit seluruh berkas implementasi dan push ke repositori GitHub menggunakan Git / GitHub CLI.
6. Kirim status/komentar ke GitHub Issue #1 menggunakan GitHub CLI: `gh issue comment 1 ...`.

---

## Verification Plan

### Automated & Build Verification
1. **Frontend Build**:
   ```powershell
   cd client
   npm install
   npm run build
   ```
   *Verifikasi*: Berkas statis ter-generate sempurna di folder `client/dist`.
2. **Backend Syntax & Dependencies Check**:
   ```powershell
   npm install
   node --check server.js
   node --check server/index.js
   ```
3. **Template Excel Validation**:
   - Uji endpoint generator template untuk memastikan file binary `.xlsx` terunduh valid dan dapat di-parse kembali oleh parser Excel.

### Manual Verification
1. Verifikasi alur login untuk tiap role (`SUPER_ADMIN`, `MUDIR`, `WAKIL_MUDIR`, `KABID`, `STAF`).
2. Uji filter periode tugas (Harian, Pekanan, Bulanan, Tahunan).
3. Uji pembuatan tugas dengan validasi RBAC penerima tugas.
4. Uji alur upload bukti kerja oleh Staf -> Review & Approval oleh Pimpinan / Kabid.
5. Uji fitur Download Template Excel dan Upload Data Batch.
6. Uji ekspor laporan.
