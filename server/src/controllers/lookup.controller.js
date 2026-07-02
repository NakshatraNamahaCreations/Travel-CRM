import { HotelPrice } from '../models/HotelPrice.js';
import { TravelActivityPrice } from '../models/TravelActivityPrice.js';
import { TransportPrice } from '../models/TransportPrice.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';

const onDate = (date) => {
  const d = date ? new Date(date) : new Date();
  return { startDate: { $lte: d }, endDate: { $gte: d } };
};

// GET /api/lookups/hotel-rate?hotel=&roomType=&mealPlan=&date=
export const hotelRate = asyncHandler(async (req, res) => {
  const { hotel, roomType, mealPlan, date } = req.query;
  const filter = { hotel, ...onDate(date) };
  if (roomType) filter.roomType = roomType;
  if (mealPlan) filter.mealPlan = mealPlan;
  const price = await HotelPrice.findOne(filter).sort('-startDate');
  return ok(res, price);
});

// GET /api/lookups/activity-rate?activity=&service=&config=&date=
export const activityRate = asyncHandler(async (req, res) => {
  const { activity, service, config, date } = req.query;
  const filter = { activity, ...onDate(date) };
  if (service) filter.service = service;
  if (config) filter.config = config;
  const price = await TravelActivityPrice.findOne(filter).sort('-startDate');
  return ok(res, price);
});

// GET /api/lookups/transport-rate?service=&config=&date=
// Config matching is forgiving: exact (case-insensitive) → substring → any config,
// since uploaded price sheets label vehicles like "Wagon R (3 Pax)" while the
// builder may just say "Wagon R".
export const transportRate = asyncHandler(async (req, res) => {
  const { service, config, date } = req.query;
  if (!service) throw ApiError.badRequest('service is required');
  const base = { service, ...onDate(date) };
  let price = null;
  if (config) {
    const escaped = config.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    price = await TransportPrice.findOne({ ...base, config: new RegExp(`^${escaped}$`, 'i') }).sort('-startDate');
    if (!price) price = await TransportPrice.findOne({ ...base, config: new RegExp(escaped, 'i') }).sort('-startDate');
  }
  if (!price) price = await TransportPrice.findOne(base).sort('-startDate');
  return ok(res, price);
});
