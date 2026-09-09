const express = require('express');
const router = express.Router();
const {
  downloadTemplate,
  importTasks,
  importKaryawan,
  importBidang
} = require('../controllers/excelController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Download template can be accessed by authenticated users (or public template)
router.get('/download/:type', downloadTemplate);

// Batch Imports
router.post('/tasks', authenticateToken, upload.single('file'), importTasks);
router.post('/karyawan', authenticateToken, authorizeRoles('SUPER_ADMIN'), upload.single('file'), importKaryawan);
router.post('/bidang', authenticateToken, authorizeRoles('SUPER_ADMIN'), upload.single('file'), importBidang);

module.exports = router;
