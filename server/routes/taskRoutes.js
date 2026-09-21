const express = require('express');
const router = express.Router();
const {
  getTasks,
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
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticateToken);

router.get('/', getTasks);
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
