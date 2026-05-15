/* Billing & Subscription Routes */
import express from 'express';
import Stripe from 'stripe';
import { authenticate, authorize } from '../middleware/auth.js';
import * as orgModel from '../models/organization.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logAction } from '../models/auditLog.js';

const router = express.Router();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const PLANS = {
  starter: { price: 99, seats: 5, requests_per_month: 1000 },
  professional: { price: 299, seats: 25, requests_per_month: 10000 },
  enterprise: { price: 999, seats: 'unlimited', requests_per_month: 'unlimited' },
};

// Get subscription status
router.get('/subscription', authenticate, authorize('admin', 'exec'), async (req, res, next) => {
  try {
    const org = await orgModel.getOrgById(req.user.org_id);
    const stats = await orgModel.getOrgStats(req.user.org_id);

    res.json({
      subscription: {
        status: org.subscription_status,
        tier: org.subscription_tier,
        plan: PLANS[org.subscription_tier],
      },
      usage: stats,
    });
  } catch (err) {
    next(err);
  }
});

// Create checkout session
router.post('/checkout', authenticate, authorize('admin', 'exec'), async (req, res, next) => {
  try {
    const { plan } = req.body;

    if (!PLANS[plan]) {
      throw new ApiError('Invalid plan', 400);
    }

    if (!stripe) {
      throw new ApiError('Stripe is not configured', 503);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: req.user.email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Orbit Resolve - ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
            description: `${PLANS[plan].requests_per_month} requests/month, ${PLANS[plan].seats} seats`,
          },
          recurring: {
            interval: 'month',
            interval_count: 1,
            aggregate_usage: 'sum',
          },
          unit_amount: PLANS[plan].price * 100,
        },
        quantity: 1,
      }],
      metadata: {
        org_id: req.user.org_id,
        plan,
      },
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/cancelled`,
    });

    res.json({ sessionId: session.id });
  } catch (err) {
    next(err);
  }
});

// Webhook for subscription updates
router.post('/webhook', async (req, res, next) => {
  try {
    if (!stripe) {
      throw new ApiError('Stripe is not configured', 503);
    }

    const sig = req.get('stripe-signature');
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { org_id, plan } = session.metadata;

      await orgModel.updateOrgSubscription(org_id, 'active', plan);
      await logAction(org_id, null, 'SUBSCRIPTION_ACTIVATED', 'organization', org_id, { plan });
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      // Handle subscription cancellation
    }

    res.status(200).send();
  } catch (err) {
    next(err);
  }
});

// Cancel subscription
router.post('/cancel', authenticate, authorize('admin', 'exec'), async (req, res, next) => {
  try {
    await orgModel.updateOrgSubscription(req.user.org_id, 'cancelled', null);
    await logAction(req.user.org_id, req.user.id, 'SUBSCRIPTION_CANCELLED', 'organization', req.user.org_id);

    res.json({ message: 'Subscription cancelled' });
  } catch (err) {
    next(err);
  }
});

export default router;
