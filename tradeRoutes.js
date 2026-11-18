import { Router } from 'express';
import * as tradeController from '../controllers/tradeController.js';

const router = Router();

/* Purchases */
router.get('/purchases', tradeController.listPurchases);
router.get('/purchases/:id', tradeController.getPurchase);
router.post('/purchases', tradeController.createPurchase);

/* Sales */
router.get('/sales', tradeController.listSales);
router.get('/sales/outstanding', tradeController.listOutstandingSales);
router.get('/sales/:id', tradeController.getSale);
router.post('/sales', tradeController.createSale);

/* Payments */
router.get('/payments', tradeController.listPayments);
router.post('/payments', tradeController.createPayment);

/* Reports */
router.get('/reports/top-fruits', tradeController.reportTopFruits);
router.get('/reports/revenue', tradeController.reportRevenue);
router.get('/reports/top-vendors', tradeController.reportTopVendors);
router.get('/reports/stock-levels', tradeController.reportStockLevels);
router.get('/reports/vendor-balances', tradeController.reportVendorBalances);
router.get('/reports/dashboard', tradeController.dashboard);

export default router;
