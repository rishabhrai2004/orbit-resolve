/* Request/Exception Management Routes */
import express from 'express';
import db from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import * as requestModel from '../models/request.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logAction } from '../models/auditLog.js';

const router = express.Router();

// Create new request/operation
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { title, description, type, target_resource, urgency, policy_id } = req.body;

    if (!title || !type || !urgency) {
      throw new ApiError('Missing required fields', 400);
    }

    if (!['low', 'medium', 'high'].includes(urgency)) {
      throw new ApiError('Invalid urgency level', 400);
    }

    const request = await requestModel.createRequest({
      org_id: req.user.org_id,
      user_id: req.user.id,
      title,
      description,
      type,
      requestor_role: req.user.role,
      target_resource,
      urgency,
      policy_id,
    });

    // Calculate risk score
    request.confidence = await requestModel.calculateRiskScore(request);

    await logAction(req.user.org_id, req.user.id, 'REQUEST_CREATED', 'request', request.id);

    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
});

// Get request details
router.get('/:requestId', authenticate, async (req, res, next) => {
  try {
    const request = await requestModel.getRequestById(req.params.requestId, req.user.org_id);

    if (!request) {
      throw new ApiError('Request not found', 404);
    }

    res.json(request);
  } catch (err) {
    next(err);
  }
});

// List requests
router.get('/', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const filters = {
      status: req.query.status,
      urgency: req.query.urgency,
      type: req.query.type,
    };

    const requests = await requestModel.listRequests(req.user.org_id, filters, limit, offset);
    res.json({ requests, limit, offset });
  } catch (err) {
    next(err);
  }
});

// Approve/Deny request
router.patch('/:requestId/approval', authenticate, authorize('manager', 'admin', 'exec'), async (req, res, next) => {
  try {
    const { status, notes } = req.body;

    if (!['approved', 'denied'].includes(status)) {
      throw new ApiError('Invalid status', 400);
    }

    const request = await requestModel.updateRequestStatus(
      req.params.requestId,
      req.user.org_id,
      status,
      req.user.id,
      notes
    );

    if (!request) {
      throw new ApiError('Request not found', 404);
    }

    await logAction(req.user.org_id, req.user.id, `REQUEST_${status.toUpperCase()}`, 'request', req.params.requestId, { notes });

    res.json(request);
  } catch (err) {
    next(err);
  }
});

// List exceptions (policy violations)
router.get('/exceptions/list', authenticate, authorize('manager', 'admin', 'exec'), async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const exceptions = await requestModel.listExceptions(req.user.org_id, limit, offset);
    res.json({ exceptions, limit, offset });
  } catch (err) {
    next(err);
  }
});

// Resolve exception
router.patch('/exceptions/:exceptionId/resolve', authenticate, authorize('admin', 'exec'), async (req, res, next) => {
  try {
    const { decision, notes } = req.body;

    if (!['override_approved', 'override_denied', 'escalate'].includes(decision)) {
      throw new ApiError('Invalid decision', 400);
    }

    // Update exception status
    const result = await db.query(
      `UPDATE exceptions SET status = $1, resolved_by = $2, resolution_notes = $3, resolved_at = NOW()
       WHERE id = $4 AND org_id = $5 RETURNING *`,
      [decision, req.user.id, notes, req.params.exceptionId, req.user.org_id]
    );

    if (result.rows.length === 0) {
      throw new ApiError('Exception not found', 404);
    }

    await logAction(req.user.org_id, req.user.id, 'EXCEPTION_RESOLVED', 'exception', req.params.exceptionId, { decision });

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
