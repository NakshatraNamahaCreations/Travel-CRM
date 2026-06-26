import { Router } from 'express';
import {
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  updateQuoteStatus,
  deleteQuote,
  quotePdf,
  emailQuote,
  emailStatus,
} from '../controllers/quote.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/email-status', emailStatus);
router.get('/', listQuotes);
router.get('/:id', getQuote);
router.get('/:id/pdf', quotePdf);
router.post('/:id/email', emailQuote);
router.post('/', createQuote);
router.put('/:id', updateQuote);
router.patch('/:id/status', updateQuoteStatus);
router.delete('/:id', authorize('admin', 'manager'), deleteQuote);

export default router;
