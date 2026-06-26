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
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createQuerySchema, updateQuerySchema } from '../validators/query.validator.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();
router.use(protect);

router.get('/stats', queryStats);
router.get('/', listQueries);
router.post('/upload-csv', upload.single('file'), uploadQueriesCsv);
router.get('/:id', getQuery);
router.post('/', validate(createQuerySchema), createQuery);
router.put('/:id', validate(updateQuerySchema), updateQuery);
router.patch('/:id/status', updateStatus);
router.delete('/:id', authorize('admin', 'manager'), deleteQuery);

export default router;
