# Vercel Deployment Fix Guide

## Issue: `FUNCTION_INVOCATION_FAILED` Error

The serverless deployment is failing because:
1. **Missing Environment Variables** - Vercel doesn't have the required DB connection string and other secrets
2. **No Database Connection** - The production database needs to be configured
3. **Missing Build Configuration** - Need proper Vercel settings

## Steps to Fix

### 1. Set Environment Variables on Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these variables:
```
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[dbname]
JWT_SECRET=[your-secret-key-at-least-32-chars]
JWT_EXPIRY=7d
STRIPE_SECRET_KEY=[your-stripe-secret]
STRIPE_WEBHOOK_SECRET=[your-webhook-secret]
CORS_ORIGIN=https://your-domain.vercel.app
NODE_ENV=production
```

### 2. Database Setup

For production, use one of:
- **Vercel Postgres** (recommended) - Integrated in Vercel
- **Amazon RDS** - Separate PostgreSQL database
- **Supabase** - PostgreSQL hosting
- **Railway** - PostgreSQL hosting

Get the `DATABASE_URL` connection string from your database provider.

### 3. Configure Database on Deployment

If you need to run migrations on deploy:
- Add `npm run migrate` to Vercel build command
- Or manually run migrations after first deployment

### 4. Rebuild on Vercel

1. Go to Vercel Dashboard
2. Click on your project
3. Go to "Deployments" tab
4. Click "Redeploy" on the latest failed deployment
5. Choose "Use existing Build Cache" (if available)

Or manually redeploy with:
```bash
vercel --prod --force
```

## Local Testing Before Deployment

```bash
# Set up production-like environment
$env:VERCEL = "true"
$env:NODE_ENV = "production"
$env:DATABASE_URL = "postgresql://orbit:localdev@localhost:5433/orbit_resolve"
npm start

# Test the endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"admin@acme.com","password":"password123"}'
```

## Troubleshooting

### Still Getting 500 Error?

1. **Check Vercel Logs**
   - Go to Vercel Dashboard → Your Project → Deployments
   - Click on failed deployment → Logs
   - Look for specific error messages

2. **Database Connection Issues**
   - Verify `DATABASE_URL` is correct
   - Check if database allows connections from Vercel IPs
   - For RDS: may need to allow inbound traffic on port 5432

3. **Missing Dependencies**
   - Ensure all packages are in `package.json`
   - Run `npm install` locally and commit `package-lock.json`

4. **Export Issues**
   - Verify `export default app;` is at end of server.js
   - Check that ES module syntax is used (`import`/`export`)

## Files Modified

- `vercel.json` - Vercel build and routing configuration
- `server.js` - Made Vercel-compatible (no listening in serverless mode)

## Next Steps

1. Connect database to Vercel
2. Add environment variables
3. Redeploy
4. Monitor logs in Vercel Dashboard
