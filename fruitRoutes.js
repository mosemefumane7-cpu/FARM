import { Router } from 'express';
import * as fruitController from '../controllers/fruitController.js';

const router = Router();

router.get('/', fruitController.list);
router.get('/prices', fruitController.listPrices);
router.get('/:id', fruitController.getOne);
router.post('/', fruitController.create);
router.put('/:id', fruitController.update);
router.put('/:id/prices', fruitController.updatePrice);
router.delete('/:id', fruitController.remove);

export default router;
