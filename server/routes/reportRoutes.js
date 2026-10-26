const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  authorizeReportScope,
  exportExcelReport,
  exportPdfReport
} = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/dashboard', getDashboardStats);
router.get('/export/excel', authorizeReportScope, exportExcelReport);
router.get('/export/pdf', authorizeReportScope, exportPdfReport);

module.exports = router;
