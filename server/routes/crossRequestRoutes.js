const express = require('express');
const router = express.Router();
const {
  createCrossRequest,
  getCrossRequests,
  respondCrossRequest
} = require('../controllers/crossRequestController');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticateToken);

router.post('/', upload.single('file_attachment'), createCrossRequest);
router.get('/', getCrossRequests);
router.patch('/:id/respond', respondCrossRequest);

module.exports = router;
