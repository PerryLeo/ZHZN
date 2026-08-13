import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { auth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();

router.use(auth, requireAdmin);
router.get('/dashboard', AdminController.dashboard);
router.get('/users', AdminController.users);
router.get('/users/:id/devices', AdminController.userDevices);
router.get('/devices', AdminController.devices);
router.post('/devices', AdminController.createDevice);
router.put('/devices/:id', AdminController.updateDevice);
router.delete('/devices/:id', AdminController.deleteDevice);
router.post('/devices/:id/bind', AdminController.bindDevice);
router.post('/devices/:id/unbind', AdminController.unbindDevice);

export default router;
