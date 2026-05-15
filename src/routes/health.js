/* Health Check Route */
import express from 'express';
import db from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        message: 'Database not configured',
        environment: process.env.VERCEL ? 'vercel' : 'local',
      });
    }

    await db.query('SELECT NOW()');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.VERCEL ? 'vercel' : 'local',
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed',
      message: err.message,
      environment: process.env.VERCEL ? 'vercel' : 'local',
    });
  }
});

export default router;
