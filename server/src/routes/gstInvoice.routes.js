import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  listGstInvoices,
  createGstInvoice,
  updateGstInvoice,
  deleteGstInvoice,
  gstInvoicePdf,
} from '../controllers/gstInvoice.controller.js';

const router = Router();
router.use(protect);

router.get('/', listGstInvoices);
router.post('/', createGstInvoice);
router.get('/:id/pdf', gstInvoicePdf);
router.patch('/:id', updateGstInvoice);
router.delete('/:id', deleteGstInvoice);

export default router;
