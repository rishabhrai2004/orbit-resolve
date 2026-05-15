/* User Management Routes */
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import * as userModel from '../models/user.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logAction } from '../models/auditLog.js';

const router = express.Router();

// Get current user profile
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await userModel.getUserById(req.user.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// List org users (admin only)
router.get('/', authenticate, authorize('admin', 'exec'), async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const users = await userModel.listOrgUsers(req.user.org_id, limit, offset);
    res.json({ users, limit, offset });
  } catch (err) {
    next(err);
  }
});

// Invite user to organization
router.post('/invite', authenticate, authorize('admin', 'exec'), async (req, res, next) => {
  try {
    const { email, name, role } = req.body;

    if (!email || !name || !role) {
      throw new ApiError('Missing required fields', 400);
    }

    if (!['employee', 'manager', 'admin', 'exec'].includes(role)) {
      throw new ApiError('Invalid role', 400);
    }

    const existing = await userModel.getUserByEmail(email);
    if (existing) {
      throw new ApiError('User already exists', 409);
    }

    // In production, send email invitation
    // For now, create user with temporary password
    const tempPassword = Math.random().toString(36).slice(-12);
    const user = await userModel.createUser(email, tempPassword, name, role, req.user.org_id);

    await logAction(req.user.org_id, req.user.id, 'USER_INVITED', 'user', user.id, { email, role });

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      tempPassword, // In production: send via email only
    });
  } catch (err) {
    next(err);
  }
});

// Update user role
router.patch('/:userId/role', authenticate, authorize('admin', 'exec'), async (req, res, next) => {
  try {
    const { role } = req.body;

    if (!role || !['employee', 'manager', 'admin', 'exec'].includes(role)) {
      throw new ApiError('Invalid role', 400);
    }

    const user = await userModel.updateUser(req.params.userId, { role });

    await logAction(req.user.org_id, req.user.id, 'ROLE_UPDATED', 'user', req.params.userId, { new_role: role });

    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
