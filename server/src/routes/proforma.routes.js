import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  listProformaInvoices,
  createProformaInvoice,
  updateProformaInvoice,
  deleteProformaInvoice,
  proformaPdf,
} from '../controllers/proforma.controller.js';

const router = Router();
router.use(protect);

router.get('/', listProformaInvoices);
router.post('/', createProformaInvoice);
router.get('/:id/pdf', proformaPdf);
router.patch('/:id', updateProformaInvoice);
router.delete('/:id', deleteProformaInvoice);

export default router;
