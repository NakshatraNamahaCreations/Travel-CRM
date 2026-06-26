import { Router } from 'express';
import {
  listPayments,
  paymentsSummary,
  createPayment,
  deletePayment,
  supplierLedger,
} from '../controllers/payment.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/summary', paymentsSummary);
router.get('/supplier-ledger', supplierLedger);
router.get('/', listPayments);
router.post('/', authorize('admin', 'manager', 'accounts'), createPayment);
router.delete('/:id', authorize('admin', 'manager', 'accounts'), deletePayment);

export default router;
