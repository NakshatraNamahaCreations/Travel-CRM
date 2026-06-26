import { Router } from 'express';
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  setUserStatus,
} from '../controllers/user.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/', listUsers);
router.get('/:id', getUser);
router.post('/', authorize('admin', 'manager'), createUser);
router.put('/:id', authorize('admin', 'manager'), updateUser);
router.patch('/:id/status', authorize('admin'), setUserStatus);

export default router;
