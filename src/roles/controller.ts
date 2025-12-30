import { Router } from 'express';
import { authMiddleware, requirePermission, AuthRequest } from '../middleware/auth';
import { roleService } from './service';
import {
  CreateRoleSchema,
  UpdateRoleSchema,
  AssignRoleSchema,
} from './types';
import { validateRequest } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Role management routes
router.post('/', requirePermission('roles:write'), validateRequest(CreateRoleSchema), async (req, res) => {
  const role = await roleService.createRole(req.body);
  res.status(201).json(role);
});

router.get('/', requirePermission('roles:read'), async (req, res) => {
  const includeUsers = req.query.includeUsers === 'true';
  const roles = await roleService.getRoles(includeUsers);
  res.json(roles);
});

router.get('/:id', requirePermission('roles:read'), async (req, res) => {
  const includeUsers = req.query.includeUsers === 'true';
  const role = await roleService.getRoleById(req.params.id, includeUsers);
  res.json(role);
});

router.put('/:id', requirePermission('roles:write'), validateRequest(UpdateRoleSchema), async (req, res) => {
  const role = await roleService.updateRole(req.params.id, req.body);
  res.json(role);
});

router.delete('/:id', requirePermission('roles:delete'), async (req, res) => {
  await roleService.deleteRole(req.params.id);
  res.status(204).send();
});

// Role assignment routes
router.post('/assign', requirePermission('roles:assign'), validateRequest(AssignRoleSchema), async (req: AuthRequest, res) => {
  await roleService.assignRole(req.body, req.user!.id);
  res.status(204).send();
});

router.delete('/:roleId/users/:userId', requirePermission('roles:assign'), async (req, res) => {
  await roleService.removeRole(req.params.userId, req.params.roleId);
  res.status(204).send();
});

router.get('/users/:userId', requirePermission('roles:read'), async (req, res) => {
  const roles = await roleService.getUserRoles(req.params.userId);
  res.json(roles);
});

export { router as roleController };
