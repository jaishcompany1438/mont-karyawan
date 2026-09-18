const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');
const patrolController = require('../controllers/patrolController');
const { getRooms, createRoom, createPatrol, getPatrols, getPatrolDashboard, updatePatrol, deletePatrol } = patrolController;

router.use(authenticateToken);
router.use((req, res, next) => {
  const { canAccessPatrol } = require('../controllers/patrolController');
  if (!canAccessPatrol(req.user)) {
    return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke modul patroli.' });
  }
  next();
});
router.get('/ruangan', getRooms);
router.post('/ruangan', createRoom);
router.get('/dashboard', getPatrolDashboard);
router.get('/', getPatrols);
router.post('/', upload.single('foto_bukti'), createPatrol);
router.put('/:id', upload.single('foto_bukti'), updatePatrol);
router.delete('/:id', deletePatrol);

module.exports = router;
