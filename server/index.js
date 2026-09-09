const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const { initDB, isDbConnected } = require('./config/db');
const seedData = require('./config/seed');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const bidangRoutes = require('./routes/bidangRoutes');
const taskRoutes = require('./routes/taskRoutes');
const excelRoutes = require('./routes/excelRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads folder
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bidang', bidangRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/templates', excelRoutes);
app.use('/api/import', excelRoutes);
app.use('/api/reports', reportRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    dbConnected: isDbConnected(),
    timestamp: new Date().toISOString()
  });
});

// Serve frontend build if exists (for Hostinger and production single-server mode)
const clientBuildPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    }
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

async function startServer() {
  await initDB();
  if (isDbConnected()) {
    await seedData();
  }

  app.listen(PORT, () => {
    console.log(`[Server] PTQ Imam Ath Thobari Monitoring Karyawan running on port ${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
