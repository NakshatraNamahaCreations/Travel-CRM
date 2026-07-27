import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  listOrganizations,
  createOrganization,
  getOrganization,
  updateOrganization,
  recordSubscriptionPayment,
  listPlans,
  createPlan,
  updatePlan,
} from '../controllers/owner.controller.js';

// Platform-owner panel. NOT tenant-scoped — mounted before the tenantContext
// middleware in routes/index.js and restricted to the 'owner' role.
const router = Router();
router.use(protect, authorize('owner'));

router.get('/organizations', listOrganizations);
router.post('/organizations', createOrganization);
router.get('/organizations/:id', getOrganization);
router.patch('/organizations/:id', updateOrganization);
router.post('/organizations/:id/subscription', recordSubscriptionPayment);

router.get('/plans', listPlans);
router.post('/plans', createPlan);
router.patch('/plans/:id', updatePlan);

export default router;
