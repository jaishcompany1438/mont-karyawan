const express = require('express');
const router = express.Router();
const {
  getTasks,
  getTodayTasks,
  getTaskById,
  createTask,
  updateTask,
  delegateTask,
  updateTaskStatus,
  submitReview,
  reviewTask,
  deleteTask,
  deleteTasks
} = require('../controllers/taskController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { TASK_MANAGEMENT_ROLES } = require('../constants/roles');
const upload = require('../middleware/upload');

router.use(authenticateToken);

// Dashboard utama: semua peran, hanya tugas hari ini. Harus berada sebelum '/:id'.
router.get('/today', getTodayTasks);
// Manajemen Tugas: hanya KABID, Wakil Mudir, Mudir dan Super Admin.
router.get('/', authorizeRoles(...TASK_MANAGEMENT_ROLES), getTasks);
router.get('/:id', getTaskById);
router.post('/', upload.single('attachment'), createTask);
router.put('/:id', upload.single('attachment'), updateTask);
router.patch('/:id/delegate', delegateTask);
router.patch('/:id/status', updateTaskStatus);
router.post('/:id/submit-review', upload.single('bukti_kerja'), submitReview);
router.post('/:id/review', reviewTask);
router.delete('/:id', deleteTask);
router.delete('/', deleteTasks);

module.exports = router;
