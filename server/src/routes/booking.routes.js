import { Router } from 'express';
import {
  listBookings,
  getBooking,
  createFromQuote,
  updateBookingStatus,
  deleteBooking,
  updateInstalmentSchedule,
} from '../controllers/booking.controller.js';
import {
  hotelBookings,
  hotelCheckins,
  operationalBookings,
  quoteBookingsDiff,
} from '../controllers/bookingViews.controller.js';
import { protect, can } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/', listBookings);
// Derived views (must precede '/:id').
router.get('/views/hotels', hotelBookings);
router.get('/views/hotel-checkins', hotelCheckins);
router.get('/views/operational', operationalBookings);
router.get('/views/quote-diff', quoteBookingsDiff);
router.get('/:id', getBooking);
router.post('/from-quote/:quoteId', can('bookings.create'), createFromQuote);
router.patch('/:id/status', updateBookingStatus);
router.put('/:id/instalment-schedule', updateInstalmentSchedule);
router.delete('/:id', can('bookings.cancel'), deleteBooking);

export default router;
