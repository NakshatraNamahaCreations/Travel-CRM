import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  listTransactions,
  transactionsSummary,
  createTransaction,
  deleteTransaction,
} from '../controllers/transaction.controller.js';

const router = Router();
router.use(protect);

const W = authorize('admin', 'manager', 'accounts');

router.get('/', listTransactions);
router.get('/summary', transactionsSummary);
router.post('/', W, createTransaction);
router.delete('/:id', W, deleteTransaction);

export default router;
