import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { AppReleaseController as controller } from '../controllers/appRelease.controller.js';

const router = Router();
router.get('/check', controller.check);
router.get('/releases/:id', controller.detail);
router.get('/releases/:id/download', controller.download);
router.use(auth, requireAdmin);
router.get('/releases', controller.list);
router.post('/releases', controller.upload);
router.put('/releases/:id', controller.edit);
router.post('/releases/:id/publish', controller.publish);
router.post('/releases/:id/withdraw', controller.withdraw);
export default router;
