import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  listInstallments,
  installmentSummary,
  accountOptions,
  createInstallment,
  logPayment,
  verifyInstallment,
  addComment,
  deleteInstallment,
} from '../controllers/installment.controller.js';

const router = Router();
router.use(protect);

router.get('/', listInstallments);
router.get('/summary', installmentSummary);
router.get('/accounts', accountOptions);
router.post('/', createInstallment);
router.post('/:id/log-payment', logPayment);
router.patch('/:id/verify', verifyInstallment);
router.post('/:id/comments', addComment);
router.delete('/:id', deleteInstallment);

export default router;
