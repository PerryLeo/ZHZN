import { Router } from 'express';
import { DeviceController } from '../controllers/device.controller.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.post('/command', auth, DeviceController.sendCommand);
router.post('/batchCommand', auth, DeviceController.batchCommand);

export default router;
