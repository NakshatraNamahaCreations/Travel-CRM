import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { listHotelNotes, createHotelNote, deleteHotelNote } from '../controllers/hotelNote.controller.js';

const router = Router();
router.use(protect);

router.get('/', listHotelNotes);
router.post('/', createHotelNote);
router.delete('/:id', deleteHotelNote);

export default router;
