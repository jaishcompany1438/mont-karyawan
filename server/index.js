const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const { initDB, isDbConnected, generateDueRecurringTasks } = require('./config/db');
const seedData = require('./config/seed');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const bidangRoutes = require('./routes/bidangRoutes');
const taskRoutes = require('./routes/taskRoutes');
const excelRoutes = require('./routes/excelRoutes');
const reportRoutes = require('./routes/reportRoutes');
const crossRequestRoutes = require('./routes/crossRequestRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bidang', bidangRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/templates', excelRoutes);
app.use('/api/import', excelRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/cross-requests', crossRequestRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    dbConnected: isDbConnected(),
    timestamp: new Date().toISOString()
  });
});

const clientBuildPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    }
  });
}

app.use((err, req, res, next) => {
  console.error('[Server Error]:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

async function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`[Server] PTQ Imam Ath Thobari Monitoring Karyawan running on port ${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  try {
    await initDB();
    if (isDbConnected()) {
      await seedData();
      const runRecurringTaskGeneration = async () => {
        try {
          const generated = await generateDueRecurringTasks();
          if (generated > 0) console.log(`[Scheduler] Generated ${generated} recurring task instance(s).`);
        } catch (error) {
          console.error('[Scheduler] Failed to generate recurring tasks:', error.message);
        }
      };
      await runRecurringTaskGeneration();
      setInterval(runRecurringTaskGeneration, 60 * 1000).unref();
    }
  } catch (error) {
    console.error('[Server] Database initialization failed:', error.message);
  }

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
