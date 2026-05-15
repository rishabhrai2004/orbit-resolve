# Orbit Resolve — Production SaaS Backend

Enterprise-grade operational decision engine with autonomous approval automation.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Stripe Account (for billing)

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database and API keys

# Run migrations
npm run migrate

# Seed demo data
npm run seed

# Start development server
npm run dev
```

## 📋 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Create account
- `POST /api/v1/auth/login` - Sign in
- `POST /api/v1/auth/verify` - Validate token
- `POST /api/v1/auth/refresh` - Get new token

### Requests (Operations)
- `POST /api/v1/requests` - Create request
- `GET /api/v1/requests` - List requests (filterable)
- `GET /api/v1/requests/:id` - Get request details
- `PATCH /api/v1/requests/:id/approval` - Approve/deny request
- `GET /api/v1/requests/exceptions/list` - List policy violations

### Policies
- `POST /api/v1/policies` - Create policy
- `GET /api/v1/policies` - List policies
- `GET /api/v1/policies/:id` - Get policy
- `PATCH /api/v1/policies/:id` - Update policy
- `DELETE /api/v1/policies/:id` - Delete policy

### Users
- `GET /api/v1/users/me` - Current user
- `GET /api/v1/users` - List org users
- `POST /api/v1/users/invite` - Invite user
- `PATCH /api/v1/users/:id/role` - Update user role

### Billing
- `GET /api/v1/billing/subscription` - Check subscription
- `POST /api/v1/billing/checkout` - Start checkout
- `POST /api/v1/billing/cancel` - Cancel subscription

### Admin
- `GET /api/v1/admin/stats` - Organization analytics
- `GET /api/v1/admin/audit-logs` - View audit trail
- `GET /api/v1/admin/organization` - Org details
- `PATCH /api/v1/admin/organization` - Update org

## 🏗️ Architecture

```
src/
├── routes/        # API endpoint handlers
├── models/        # Database models
├── middleware/    # Auth, validation, error handling
├── services/      # Business logic & integrations
├── utils/         # Helpers & validators
└── db.js          # Connection pool

scripts/
├── migrate.js     # Database schema
└── seed.js        # Demo data
```

## 🔐 Security

- JWT authentication with 7-day expiry
- bcryptjs password hashing (12 rounds)
- Request rate limiting (100 req/15min)
- CORS validation
- SQL injection prevention (parameterized queries)
- Helmet security headers
- RBAC: employee, manager, admin, exec
- Audit logging of all actions
- IP tracking for compliance

## 📊 Database Schema

**organizations** - Multi-tenant accounts
**users** - Organization members with roles
**requests** - Operational approval requests
**exceptions** - Policy violation records
**policies** - Automation rules & thresholds
**audit_logs** - Immutable action trail

## 💳 SaaS Features

**Subscription Tiers:**
- Starter: $99/mo, 5 seats, 1k requests/mo
- Professional: $299/mo, 25 seats, 10k requests/mo
- Enterprise: $999/mo, unlimited seats, unlimited requests

**Stripe Integration:**
- Monthly billing via checkout sessions
- Webhook handling for subscription events
- Usage tracking per organization

## 📈 Request Processing

1. **Submission** - User creates request
2. **Risk Scoring** - ML-based confidence calculation
3. **Policy Matching** - Compare against defined policies
4. **Auto-Approval** - If confidence > threshold
5. **Exception Handling** - Flag policy violations for review
6. **Audit Logging** - Track all decisions

## 🧪 Testing

```bash
npm test
```

## 🚀 Deployment

**Docker**
```bash
docker build -t orbit-resolve .
docker run -e DATABASE_URL=... -p 3000:3000 orbit-resolve
```

**Environment Variables**
```
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
STRIPE_SECRET_KEY=sk_live_...
CORS_ORIGIN=https://app.orbitresolve.com
```

## 📧 Support

For issues or questions, contact: support@orbitresolve.com

---

**Orbit Resolve v3.0.0** — Enterprise Operations Automation
