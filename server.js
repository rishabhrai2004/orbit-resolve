import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
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

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

// ──── Security ────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
    }
  }
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ──── Request ID Tracking ────
app.use((req, res, next) => {
  req.id = req.get('x-request-id') || uuidv4();
  res.set('x-request-id', req.id);
  next();
});

// ──── Logging ────
app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    logger.info({
      reqId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    }, 'request completed');
  });

  next();
});

// ──── Body Parsing ────
app.use('/api/v1/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: process.env.MAX_REQUEST_SIZE || '10mb' }));
app.use(express.urlencoded({ limit: process.env.MAX_REQUEST_SIZE || '10mb', extended: true }));

// ──── Static Files ────
app.use(express.static(__dirname, { index: false }));

app.get('/', (req, res) => {
  // If on Vercel without DATABASE_URL, show setup instructions
  if (process.env.VERCEL && !process.env.DATABASE_URL) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Orbit Resolve — Setup Required</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; color: #333; }
          h1 { color: #5b21b6; }
          .box { background: #f3f4f6; border-left: 4px solid #5b21b6; padding: 20px; margin: 20px 0; border-radius: 4px; }
          code { background: #e5e7eb; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
          .steps { margin: 20px 0; }
          .step { margin: 15px 0; }
          .step strong { color: #5b21b6; }
          button { background: #5b21b6; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; }
          button:hover { background: #4c1d95; }
        </style>
      </head>
      <body>
        <h1>🚀 Orbit Resolve — Setup Required</h1>
        
        <div class="box">
          <strong>⚠️ Database Not Configured</strong>
          <p>The <code>DATABASE_URL</code> environment variable is not set on Vercel.</p>
        </div>

        <h2>Quick Setup (5 minutes)</h2>
        
        <div class="steps">
          <div class="step">
            <strong>1. Get a PostgreSQL Database</strong>
            <p>Choose one:</p>
            <ul>
              <li><strong>Vercel Postgres</strong> (easiest) — Built into Vercel Dashboard</li>
              <li><strong>Supabase</strong> (free) — supabase.com</li>
              <li><strong>Railway</strong> (fast) — railway.app</li>
              <li><strong>Amazon RDS</strong> — aws.amazon.com</li>
            </ul>
          </div>

          <div class="step">
            <strong>2. Set Environment Variable</strong>
            <p>Go to Vercel Dashboard → Your Project → Settings → Environment Variables</p>
            <p>Add: <code>DATABASE_URL</code> = <code>postgresql://user:password@host:port/dbname</code></p>
          </div>

          <div class="step">
            <strong>3. Redeploy</strong>
            <p>Go to Deployments → Latest Failed → Redeploy</p>
          </div>

          <div class="step">
            <strong>4. Run Migrations</strong>
            <p>After redeployment succeeds, manually run migrations using the Vercel CLI:</p>
            <p><code>vercel env pull && npm run migrate</code></p>
          </div>
        </div>

        <div class="box">
          <strong>📝 Demo Credentials (once setup)</strong>
          <ul>
            <li>Email: <code>admin@acme.com</code></li>
            <li>Password: <code>password123</code></li>
          </ul>
        </div>

        <button onclick="location.reload()">🔄 Check Again</button>
      </body>
      </html>
    `);
  }

  // Otherwise serve login page
  res.sendFile(path.join(__dirname, 'login.html'));
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

// ──── Database Health Check Middleware ────
// For serverless: provide helpful error if DATABASE_URL is missing
app.use((req, res, next) => {
  if (!process.env.DATABASE_URL && process.env.VERCEL) {
    // Only fail on API routes, not static files
    if (req.path.startsWith('/api/')) {
      return res.status(503).json({
        error: 'Database not configured',
        message: 'DATABASE_URL environment variable is not set on Vercel',
        solution: 'Add DATABASE_URL to Vercel project settings → Environment Variables',
        code: 'DATABASE_NOT_CONFIGURED'
      });
    }
    // Allow static files to serve even without DB
  }
  next();
});

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

// ──── Graceful Shutdown & Startup ────
// Only listen if not in a serverless environment (Vercel, AWS Lambda, etc)
if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
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
} else if (process.env.VERCEL) {
  // For Vercel serverless: test DB connection on startup
  db.query('SELECT NOW()').then(() => {
    console.log(`✓ Database connected (serverless)`);
  }).catch((err) => {
    console.error('✗ Database connection failed (serverless):', err);
  });
}

export default app;
