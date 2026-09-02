import { Router } from 'express';
import * as authController from './auth.controller';
import { loginRateLimiter } from '../../middlewares/rateLimit';
import { requireAuth } from '../../middlewares/auth';

export const authRouter = Router();

authRouter.post('/login', loginRateLimiter, authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAuth, authController.me);
