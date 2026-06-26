import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
} from '../controllers/account.controller.js';

const router = Router();
router.use(protect);

const W = authorize('admin', 'manager', 'accounts');

router.get('/', listAccounts);
router.get('/:id', getAccount);
router.post('/', W, createAccount);
router.patch('/:id', W, updateAccount);
router.delete('/:id', W, deleteAccount);

export default router;
