import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { auth } from '../middleware/auth.js';

const router = Router();

// 公开接口
router.post('/register', UserController.register);
router.post('/login', UserController.login);

// 需登录
router.get('/profile', auth, UserController.profile);
router.post('/bindDevice', auth, UserController.bindDevice);
router.get('/devices/summary', auth, UserController.myDeviceSummary);
router.get('/devices', auth, UserController.myDevices);
router.post('/updateDeviceRemark', auth, UserController.updateDeviceRemark);
router.post('/unbindDevice', auth, UserController.unbindDevice);
router.post('/resetPassword', auth, UserController.resetPassword);
router.post('/changePassword', auth, UserController.changePassword);

export default router;
