import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole, requirePermission, AuthRequest } from '../middleware/auth';
import { userService } from './service';
import {
  CreateUserSchema,
  UpdateUserSchema,
  ChangePasswordSchema,
  LoginSchema,
  EnableMfaSchema,
} from './types';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Public routes
router.post('/register', validateRequest(CreateUserSchema), async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(201).json(user);
});

router.post('/login', validateRequest(LoginSchema), async (req, res) => {
  const result = await userService.login(req.body);
  res.json(result);
});

// Protected routes
router.use(authMiddleware);

router.get('/me', async (req: AuthRequest, res) => {
  const user = await userService.getUserById(req.user!.id, true);
  res.json(user);
});

router.put('/me', validateRequest(UpdateUserSchema), async (req: AuthRequest, res) => {
  const user = await userService.updateUser(req.user!.id, req.body);
  res.json(user);
});

router.post('/change-password', validateRequest(ChangePasswordSchema), async (req: AuthRequest, res) => {
  await userService.changePassword(req.user!.id, req.body);
  res.status(204).send();
});

// MFA routes
router.post('/mfa/setup', async (req: AuthRequest, res) => {
  const setup = await userService.generateMfaSetup(req.user!.id);
  res.json(setup);
});

router.post('/mfa/enable', validateRequest(EnableMfaSchema), async (req: AuthRequest, res) => {
  await userService.enableMfa(req.body);
  res.status(204).send();
});

router.post('/mfa/disable', async (req: AuthRequest, res) => {
  await userService.disableMfa(req.user!.id);
  res.status(204).send();
});

// Admin-only routes
router.get('/:id', requirePermission('users:read'), async (req, res) => {
  const user = await userService.getUserById(req.params.id, true);
  res.json(user);
});

router.put('/:id', requirePermission('users:write'), validateRequest(UpdateUserSchema), async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body);
  res.json(user);
});

export { router as userController };
