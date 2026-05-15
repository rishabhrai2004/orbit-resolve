/* Authentication Routes */
import express from 'express';
import * as userModel from '../models/user.js';
import * as orgModel from '../models/organization.js';
import { generateToken, authenticate } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = express.Router();

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, organization_name } = req.body;

    if (!email || !password || !name || !organization_name) {
      throw new ApiError('Missing required fields', 400);
    }

    const existing = await userModel.getUserByEmail(email);
    if (existing) {
      throw new ApiError('Email already registered', 409);
    }

    const user = await userModel.createUser(email, password, name, 'admin', null);
    const org = await orgModel.createOrganization(organization_name, user.id);

    await userModel.updateUser(user.id, { org_id: org.id });

    const token = generateToken({ ...user, org_id: org.id });

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
      organization: org,
      token,
    });
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError('Email and password required', 400);
    }

    const user = await userModel.getUserByEmail(email);
    if (!user) {
      throw new ApiError('Invalid credentials', 401);
    }

    const isValid = await userModel.verifyPassword(password, user.password_hash);
    if (!isValid) {
      throw new ApiError('Invalid credentials', 401);
    }

    const token = generateToken(user);

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      organization: { id: user.org_id },
      token,
    });
  } catch (err) {
    next(err);
  }
});

// Verify Token
router.post('/verify', authenticate, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Refresh Token
router.post('/refresh', authenticate, (req, res) => {
  const token = generateToken(req.user);
  res.json({ token });
});

export default router;
