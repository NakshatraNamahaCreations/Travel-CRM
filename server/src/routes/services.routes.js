import { Hotel } from '../models/Hotel.js';
import { HotelPrice } from '../models/HotelPrice.js';
import { TransportService } from '../models/TransportService.js';
import { TransportPrice } from '../models/TransportPrice.js';
import { TravelActivity } from '../models/TravelActivity.js';
import { TravelActivityPrice } from '../models/TravelActivityPrice.js';
import { crudFactory } from '../utils/crudFactory.js';
import { makeCrudRouter } from './_crudRouter.js';
import { authorize } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { mergeHotels } from '../controllers/hotel.controller.js';

// Inventory is maintained by ops + management.
const W = { writeRoles: ['admin', 'manager', 'operations'] };
const stampCreator = (req) => ({ createdBy: req.user._id });

export const hotelRoutes = makeCrudRouter(
  crudFactory(Hotel, {
    searchFields: ['name', 'location.city', 'address'],
    populate: [{ path: 'destinations', select: 'name' }],
    injectOnCreate: stampCreator,
  }),
  W
);
// Custom: merge a duplicate hotel into a primary one (POST /hotels/merge).
hotelRoutes.post('/merge', authorize(...W.writeRoles), mergeHotels);

export const hotelPriceRoutes = makeCrudRouter(
  crudFactory(HotelPrice, {
    searchFields: ['mealPlan', 'roomType'],
    filterFields: ['hotel', 'mealPlan', 'roomType'],
    populate: [{ path: 'hotel', select: 'name location stars' }],
    sort: '-startDate',
    injectOnCreate: stampCreator,
  }),
  W
);

export const transportRoutes = makeCrudRouter(
  crudFactory(TransportService, {
    searchFields: ['name', 'from', 'to'],
    populate: [{ path: 'destinations', select: 'name' }],
    injectOnCreate: stampCreator,
  }),
  W
);
// Custom: bulk-disable every active transport service.
transportRoutes.post('/bulk-disable', authorize(...W.writeRoles), asyncHandler(async (req, res) => {
  const r = await TransportService.updateMany({ isActive: true }, { isActive: false });
  return ok(res, { disabled: r.modifiedCount });
}));

export const transportPriceRoutes = makeCrudRouter(
  crudFactory(TransportPrice, {
    searchFields: ['config', 'itemName'],
    filterFields: ['service'],
    populate: [{ path: 'service', select: 'name from to' }],
    sort: '-startDate',
    injectOnCreate: stampCreator,
  }),
  W
);

export const activityRoutes = makeCrudRouter(
  crudFactory(TravelActivity, {
    searchFields: ['name'],
    populate: [{ path: 'destinations', select: 'name' }],
    injectOnCreate: stampCreator,
  }),
  W
);
// Custom: bulk-disable every active travel activity.
activityRoutes.post('/bulk-disable', authorize(...W.writeRoles), asyncHandler(async (req, res) => {
  const r = await TravelActivity.updateMany({ isActive: { $ne: false } }, { isActive: false });
  return ok(res, { disabled: r.modifiedCount });
}));

export const activityPriceRoutes = makeCrudRouter(
  crudFactory(TravelActivityPrice, {
    searchFields: ['service', 'config'],
    filterFields: ['activity'],
    populate: [{ path: 'activity', select: 'name' }],
    sort: '-startDate',
    injectOnCreate: stampCreator,
  }),
  W
);
