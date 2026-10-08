import { Router } from 'express';
import express from 'express';
import { auth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { OtaController } from '../controllers/ota.controller.js';

const router = Router();

router.use(auth);
router.get('/firmwares', requireAdmin, OtaController.firmwares);
router.post('/firmwares', requireAdmin, express.raw({ type: 'application/octet-stream', limit: '10mb' }), OtaController.uploadFirmware);
router.post('/preview', requireAdmin, OtaController.preview);
router.post('/batches', requireAdmin, OtaController.createBatch);
router.get('/batches', requireAdmin, OtaController.batches);
router.get('/batches/:batchId', requireAdmin, OtaController.batch);
router.post('/batches/:batchId/pause', requireAdmin, OtaController.pauseBatch);
router.post('/batches/:batchId/resume', requireAdmin, OtaController.resumeBatch);
router.post('/batches/:batchId/retry-failed', requireAdmin, OtaController.retryFailed);
router.post('/start', OtaController.start);
router.get('/tasks/:taskId', OtaController.task);

export default router;
