import { Router } from 'express';
import * as fruitController from '../controllers/fruitController.js';

const router = Router();

router.get('/', fruitController.listStock);
router.get('/low', fruitController.listLowStock);
router.patch('/:id', fruitController.updateThreshold);

export default router;
