import { Router } from 'express';
import * as vendorController from '../controllers/vendorController.js';

const router = Router();

router.get('/', vendorController.list);
router.get('/:id', vendorController.getOne);
router.post('/', vendorController.create);
router.put('/:id', vendorController.update);
router.delete('/:id', vendorController.remove);

export default router;
