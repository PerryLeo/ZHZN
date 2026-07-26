import { Router } from 'express';
import userRoutes from './user.routes.js';
import deviceRoutes from './device.routes.js';

const router = Router();

// 挂载各模块路由
router.use('/users', userRoutes);
router.use('/devices', deviceRoutes);

// 后续可扩展更多模块，例如:
// router.use('/orders', orderRoutes);
// router.use('/products', productRoutes);

export default router;
