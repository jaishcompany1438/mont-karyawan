const express = require('express');
const router = express.Router();
const { getAllUsers, getAssignees, createUser, updateUser, deleteUser } = require('../controllers/userController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/assignees', getAssignees);
router.get('/', getAllUsers);
router.post('/', authorizeRoles('SUPER_ADMIN'), createUser);
router.put('/:id', authorizeRoles('SUPER_ADMIN'), updateUser);
router.delete('/:id', authorizeRoles('SUPER_ADMIN'), deleteUser);

module.exports = router;
