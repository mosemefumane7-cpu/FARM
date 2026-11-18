import { Router } from 'express';
import supplierRoutes from './supplierRoutes.js';
import fruitRoutes from './fruitRoutes.js';
import stockRoutes from './stockRoutes.js';
import vendorRoutes from './vendorRoutes.js';
import tradeRoutes from './tradeRoutes.js';
import { testConnection } from '../config/db.js';

const router = Router();

router.get('/health', async (req, res) => {
  const database = await testConnection();
  res.status(database.connected ? 200 : 503).json({
    success: database.connected,
    service: 'batloung-farm-api',
    database,
    timestamp: new Date().toISOString(),
  });
});

router.use('/suppliers', supplierRoutes);
router.use('/fruits', fruitRoutes);
router.use('/stock', stockRoutes);
router.use('/vendors', vendorRoutes);
router.use('/', tradeRoutes);

export default router;
