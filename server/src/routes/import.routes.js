import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { protect, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/apiResponse.js';
import { importWorkbook, detectType } from '../import/core.mjs';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();
router.use(protect);

// POST /api/services/import  (multipart: file, optional type=auto|hotels|transport|activities)
router.post(
  '/',
  authorize('admin', 'manager', 'operations'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No file uploaded');
    let wb;
    try {
      wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    } catch {
      throw ApiError.badRequest('Could not read the Excel file');
    }
    const type = req.body.type || 'auto';
    let destinations = [];
    if (req.body.destinations) {
      try { destinations = JSON.parse(req.body.destinations); } catch { destinations = String(req.body.destinations).split(',').map((s) => s.trim()).filter(Boolean); }
    }
    const detected = detectType(wb);
    const summary = await importWorkbook(wb, type, { destinations });
    return ok(res, { file: req.file.originalname, detected, sheets: wb.SheetNames.length, ...summary });
  })
);

export default router;
