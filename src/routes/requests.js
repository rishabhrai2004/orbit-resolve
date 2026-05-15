/* Request/Exception Management Routes */
import express from 'express';
import db from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import * as requestModel from '../models/request.js';
import { generateRecommendation } from '../services/ai.js';
import { classifyRequest, evaluateRequest } from '../services/riskEngine.js';
import { executeProvisioning } from '../services/integrations.js';
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

    const normalizedType = classifyRequest({ title, description, type, target_resource });

    const request = await requestModel.createRequest({
      org_id: req.user.org_id,
      user_id: req.user.id,
      title,
      description,
      type: normalizedType,
      requestor_role: req.user.role,
      target_resource,
      urgency,
      policy_id,
    });

    const decision = await evaluateRequest(request);
    const updated = await requestModel.applyDecision(request.id, req.user.org_id, decision);
    let provisioning = null;

    if (decision.status === 'approved') {
      provisioning = await executeProvisioning({ ...updated, decision_type: decision.type }, req.user);
    } else {
      await requestModel.createException({
        org_id: req.user.org_id,
        request_id: request.id,
        reason: {
          summary: 'Policy threshold or confidence gate requires review',
          blockers: decision.blockers,
        },
        policy_conflict: {
          policy: `${decision.policy.code} · ${decision.policy.name}`,
          rule: decision.policy.threshold,
          actual: decision.blockers.map((b) => b.message).join('; ') || 'Confidence below automation threshold',
        },
        recommendation: decision.recommendation,
        user_id: req.user.id,
      });
    }

    let aiResult = {
      text: `${decision.recommendation.action}: ${decision.recommendation.reasoning}`,
      meta: { source: 'policy-engine', fallback: decision.recommendation },
    };
    try {
      aiResult = await generateRecommendation(req.user.org_id, { ...updated, id: request.id, confidence: decision.confidence });
    } catch (err) {
      console.warn('AI recommendation failed:', err.message || err);
    }

    await logAction(
      req.user.org_id,
      req.user.id,
      decision.status === 'approved' ? 'REQUEST_AUTO_APPROVED' : 'REQUEST_REVIEW_REQUIRED',
      'request',
      request.id,
      { decision, provisioning }
    );

    res.status(201).json({
      ...(updated || request),
      decision,
      provisioning,
      ai_recommendation: aiResult,
    });
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

    await db.query(
      `UPDATE exceptions
       SET status = $1, resolved_by = $2, resolution_notes = $3, resolved_at = NOW(), updated_at = NOW()
       WHERE request_id = $4 AND org_id = $5 AND status = 'pending'`,
      [status === 'approved' ? 'override_approved' : 'override_denied', req.user.id, notes, req.params.requestId, req.user.org_id]
    );

    await logAction(req.user.org_id, req.user.id, `REQUEST_${status.toUpperCase()}`, 'request', req.params.requestId, { notes });

    res.json(request);
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
