const express = require('express');
const router = express.Router();
const { getAllBidang, createBidang, updateBidang, deleteBidang } = require('../controllers/bidangController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', getAllBidang);
router.post('/', authorizeRoles('SUPER_ADMIN'), createBidang);
router.put('/:id', authorizeRoles('SUPER_ADMIN'), updateBidang);
router.delete('/:id', authorizeRoles('SUPER_ADMIN'), deleteBidang);

module.exports = router;
