/* Policy Management Routes */
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import * as policyModel from '../models/policy.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logAction } from '../models/auditLog.js';

const router = express.Router();

// Create policy
router.post('/', authenticate, authorize('admin', 'exec'), async (req, res, next) => {
  try {
    const { name, description, threshold, auto_approval_rate } = req.body;

    if (!name || !description) {
      throw new ApiError('Missing required fields', 400);
    }

    const policy = await policyModel.createPolicy({
      org_id: req.user.org_id,
      name,
      description,
      threshold,
      auto_approval_rate,
    });

    await logAction(req.user.org_id, req.user.id, 'POLICY_CREATED', 'policy', policy.id);

    res.status(201).json(policy);
  } catch (err) {
    next(err);
  }
});

// List policies
router.get('/', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const policies = await policyModel.listPolicies(req.user.org_id, limit);
    res.json({ policies });
  } catch (err) {
    next(err);
  }
});

// Get policy details
router.get('/:policyId', authenticate, async (req, res, next) => {
  try {
    const policy = await policyModel.getPolicyById(req.params.policyId, req.user.org_id);

    if (!policy) {
      throw new ApiError('Policy not found', 404);
    }

    res.json(policy);
  } catch (err) {
    next(err);
  }
});

// Update policy
router.patch('/:policyId', authenticate, authorize('admin', 'exec'), async (req, res, next) => {
  try {
    const { name, description, threshold, auto_approval_rate } = req.body;

    const policy = await policyModel.updatePolicy(req.params.policyId, req.user.org_id, {
      name,
      description,
      threshold,
      auto_approval_rate,
    });

    if (!policy) {
      throw new ApiError('Policy not found', 404);
    }

    await logAction(req.user.org_id, req.user.id, 'POLICY_UPDATED', 'policy', req.params.policyId);

    res.json(policy);
  } catch (err) {
    next(err);
  }
});

// Delete policy
router.delete('/:policyId', authenticate, authorize('admin', 'exec'), async (req, res, next) => {
  try {
    const policy = await policyModel.getPolicyById(req.params.policyId, req.user.org_id);

    if (!policy) {
      throw new ApiError('Policy not found', 404);
    }

    await policyModel.deletePolicy(req.params.policyId, req.user.org_id);
    await logAction(req.user.org_id, req.user.id, 'POLICY_DELETED', 'policy', req.params.policyId);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
