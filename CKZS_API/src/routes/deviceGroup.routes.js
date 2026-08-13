import { Router } from 'express';
import { DeviceGroupController } from '../controllers/deviceGroup.controller.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.use(auth);
router.get('/', DeviceGroupController.list);
router.post('/', DeviceGroupController.create);

export default router;
