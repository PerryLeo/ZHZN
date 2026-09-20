import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { OtaController } from '../controllers/ota.controller.js';

const router = Router();

router.use(auth);
router.post('/start', OtaController.start);
router.get('/tasks/:taskId', OtaController.task);

export default router;
