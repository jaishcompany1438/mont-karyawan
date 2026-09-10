const express = require('express');
const router = express.Router();
const { getDashboardStats, exportExcelReport, exportPdfReport } = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/dashboard', getDashboardStats);
router.get('/export/excel', exportExcelReport);
router.get('/export/pdf', exportPdfReport);

module.exports = router;
