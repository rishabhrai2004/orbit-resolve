import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

import db from './src/db.js';
import { errorHandler, notFoundHandler } from './src/middleware/errorHandler.js';
import authRoutes from './src/routes/auth.js';
import userRoutes from './src/routes/users.js';
import requestRoutes from './src/routes/requests.js';
import policyRoutes from './src/routes/policies.js';
import billingRoutes from './src/routes/billing.js';
import adminRoutes from './src/routes/admin.js';
import healthRoutes from './src/routes/health.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ──── Security ────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ──── Logging ────
app.use(pinoHttp({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
}));

// ──── Body Parsing ────
app.use(express.json({ limit: process.env.MAX_REQUEST_SIZE || '10mb' }));
app.use(express.urlencoded({ limit: process.env.MAX_REQUEST_SIZE || '10mb', extended: true }));

// ──── Request ID Tracking ────
app.use((req, res, next) => {
  req.id = req.get('x-request-id') || uuidv4();
  res.set('x-request-id', req.id);
  next();
});

// ──── Rate Limiting ────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ──── Routes ────
app.use('/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/requests', requestRoutes);
app.use('/api/v1/policies', policyRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/admin', adminRoutes);

// ──── Error Handling ────
app.use(notFoundHandler);
app.use(errorHandler);

// ──── Graceful Shutdown ────
const server = app.listen(port, process.env.HOST || '0.0.0.0', async () => {
  try {
    await db.query('SELECT NOW()');
    console.log(`✓ Database connected`);
    console.log(`✓ Orbit Resolve running on ${process.env.HOST || '0.0.0.0'}:${port}`);
  } catch (err) {
    console.error('✗ Database connection failed:', err);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await db.end();
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
