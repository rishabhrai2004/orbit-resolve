/* Admin & Organization Management Routes */
import express from 'express';
import db from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import * as orgModel from '../models/organization.js';
import * as logModel from '../models/auditLog.js';
import { logAction } from '../models/auditLog.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = express.Router();

// Get organization stats & analytics
router.get('/stats', authenticate, authorize('admin', 'exec'), async (req, res, next) => {
  try {
    const stats = await orgModel.getOrgStats(req.user.org_id);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// Get audit logs
router.get('/audit-logs', authenticate, authorize('admin', 'exec'), async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const filters = {
      action: req.query.action,
      entity_type: req.query.entity_type,
      user_id: req.query.user_id,
    };

    const logs = await logModel.listAuditLogs(req.user.org_id, filters, limit, offset);
    res.json({ logs, limit, offset });
  } catch (err) {
    next(err);
  }
});

// Get organization details
router.get('/organization', authenticate, authorize('admin', 'exec'), async (req, res, next) => {
  try {
    const org = await orgModel.getOrgById(req.user.org_id);
    res.json(org);
  } catch (err) {
    next(err);
  }
});

// Update organization settings
router.patch('/organization', authenticate, authorize('admin', 'exec'), async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name) {
      throw new ApiError('Name required', 400);
    }

    const result = await db.query(
      'UPDATE organizations SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [name, req.user.org_id]
    );

    await logAction(req.user.org_id, req.user.id, 'ORG_UPDATED', 'organization', req.user.org_id);

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
