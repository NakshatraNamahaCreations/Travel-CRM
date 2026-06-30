import { Router } from 'express';
import multer from 'multer';
import {
  listQueries,
  queryStats,
  getQuery,
  createQuery,
  updateQuery,
  updateStatus,
  deleteQuery,
  uploadQueriesCsv,
} from '../controllers/query.controller.js';
import { protect, can } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createQuerySchema, updateQuerySchema } from '../validators/query.validator.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();
router.use(protect);

router.get('/stats', queryStats);
router.get('/', listQueries);
router.post('/upload-csv', upload.single('file'), uploadQueriesCsv);
router.get('/:id', getQuery);
router.post('/', can('trips.create'), validate(createQuerySchema), createQuery);
router.put('/:id', can('trips.edit'), validate(updateQuerySchema), updateQuery);
router.patch('/:id/status', updateStatus);
router.delete('/:id', can('trips.delete'), deleteQuery);

export default router;
