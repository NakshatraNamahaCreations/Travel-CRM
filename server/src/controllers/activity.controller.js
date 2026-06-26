import { Activity } from '../models/Activity.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';

// Fire-and-forget audit logger — never throws into the caller's flow.
export async function logActivity(queryId, userId, message, type = 'note') {
  try {
    if (queryId && message) await Activity.create({ query: queryId, user: userId, message, type });
  } catch {
    /* non-fatal */
  }
}

// GET /api/activities?query=<id>
export const listActivities = asyncHandler(async (req, res) => {
  if (!req.query.query) throw ApiError.badRequest('query id is required');
  const items = await Activity.find({ query: req.query.query }).populate('user', 'name').sort('-createdAt').limit(200);
  return ok(res, items);
});
