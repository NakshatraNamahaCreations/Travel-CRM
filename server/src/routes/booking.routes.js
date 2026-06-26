import { Router } from 'express';
import {
  listBookings,
  getBooking,
  createFromQuote,
  updateBookingStatus,
  deleteBooking,
} from '../controllers/booking.controller.js';
import {
  hotelBookings,
  hotelCheckins,
  operationalBookings,
  flightBookings,
  quoteBookingsDiff,
} from '../controllers/bookingViews.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/', listBookings);
// Derived views (must precede '/:id').
router.get('/views/hotels', hotelBookings);
router.get('/views/hotel-checkins', hotelCheckins);
router.get('/views/operational', operationalBookings);
router.get('/views/flights', flightBookings);
router.get('/views/quote-diff', quoteBookingsDiff);
router.get('/:id', getBooking);
router.post('/from-quote/:quoteId', createFromQuote);
router.patch('/:id/status', updateBookingStatus);
router.delete('/:id', authorize('admin', 'manager'), deleteBooking);

export default router;
