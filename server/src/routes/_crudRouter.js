import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';

/**
 * Wires a crudFactory object onto a router.
 * Reads require auth; writes require one of `writeRoles` (default admin/manager).
 */
export function makeCrudRouter(crud, { writeRoles = ['admin', 'manager'] } = {}) {
  const router = Router();
  const canWrite = authorize(...writeRoles);

  router.use(protect);
  router.get('/', crud.list);
  router.get('/:id', crud.get);
  router.post('/', canWrite, crud.create);
  router.put('/:id', canWrite, crud.update);
  router.delete('/:id', canWrite, crud.remove);

  return router;
}
