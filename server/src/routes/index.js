import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import { teamRoutes } from './team.routes.js';
import {
  destinationRoutes,
  querySourceRoutes,
  tagRoutes,
  inclusionExclusionRoutes,
} from './masterData.routes.js';
import queryRoutes from './query.routes.js';
import quoteRoutes from './quote.routes.js';
import lookupRoutes from './lookup.routes.js';
import reportRoutes from './report.routes.js';
import bookingRoutes from './booking.routes.js';
import serviceBookingRoutes from './serviceBooking.routes.js';
import paymentRoutes from './payment.routes.js';
import installmentRoutes from './installment.routes.js';
import accountRoutes from './account.routes.js';
import proformaRoutes from './proforma.routes.js';
import orgProfileRoutes from './orgProfile.routes.js';
import transactionRoutes from './transaction.routes.js';
import gatewayRoutes from './gateway.routes.js';
import activityLogRoutes from './activity.routes.js';
import importRoutes from './import.routes.js';
import commentRoutes from './comment.routes.js';
import notificationRoutes from './notification.routes.js';
import optionRoutes from './option.routes.js';
import hotelNoteRoutes from './hotelNote.routes.js';
import { cityRoutes, stateRoutes } from './location.routes.js';
import {
  hotelRoutes,
  hotelPriceRoutes,
  transportRoutes,
  transportPriceRoutes,
  activityRoutes,
  activityPriceRoutes,
} from './services.routes.js';

const router = Router();

router.get('/', (req, res) =>
  res.json({ name: 'Travel CRM API', version: '0.1.0', status: 'ok' })
);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/teams', teamRoutes);
router.use('/destinations', destinationRoutes);
router.use('/query-sources', querySourceRoutes);
router.use('/tags', tagRoutes);
router.use('/inclusion-exclusions', inclusionExclusionRoutes);
router.use('/queries', queryRoutes);
router.use('/quotes', quoteRoutes);
router.use('/comments', commentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/options', optionRoutes);
router.use('/lookups', lookupRoutes);
router.use('/reports', reportRoutes);
router.use('/bookings', bookingRoutes);
router.use('/service-bookings', serviceBookingRoutes);
router.use('/payments', paymentRoutes);
router.use('/installments', installmentRoutes);
router.use('/accounts', accountRoutes);
router.use('/proforma-invoices', proformaRoutes);
router.use('/org-profile', orgProfileRoutes);
router.use('/transactions', transactionRoutes);
router.use('/gateways', gatewayRoutes);
router.use('/activity-log', activityLogRoutes);

// Location master data
router.use('/states', stateRoutes);
router.use('/cities', cityRoutes);

// Services / supplier inventory
router.use('/hotels', hotelRoutes);
router.use('/hotel-notes', hotelNoteRoutes);
router.use('/hotel-prices', hotelPriceRoutes);
router.use('/transport-services', transportRoutes);
router.use('/transport-prices', transportPriceRoutes);
router.use('/travel-activities', activityRoutes);
router.use('/travel-activity-prices', activityPriceRoutes);
router.use('/services/import', importRoutes);

export default router;
