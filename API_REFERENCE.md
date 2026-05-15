/* API Reference Documentation */

# Orbit Resolve API v3.0.0

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication
All protected endpoints require `Authorization: Bearer <token>` header

## Response Format
All responses include standard fields:
- `success`: boolean
- `data`: response payload
- `error`: error message (if failed)
- `requestId`: unique request identifier

## Endpoints

### Authentication

#### Register
```
POST /auth/register

Request:
{
  "email": "user@company.com",
  "password": "securepass123",
  "name": "John Doe",
  "organization_name": "Acme Corp"
}

Response:
{
  "user": { "id", "email", "name" },
  "organization": { "id", "name" },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Login
```
POST /auth/login

Request:
{
  "email": "user@company.com",
  "password": "securepass123"
}

Response:
{
  "user": { "id", "email", "name", "role" },
  "organization": { "id" },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Verify Token
```
POST /auth/verify
Headers: Authorization: Bearer <token>

Response:
{
  "valid": true,
  "user": { "id", "email", "org_id", "role" }
}
```

### Requests/Operations

#### Create Request
```
POST /requests
Headers: Authorization: Bearer <token>

Request:
{
  "title": "GitHub repo access",
  "description": "Grant access to core-api repo for platform migration",
  "type": "SaaS Provisioning",
  "urgency": "low",
  "target_resource": "github.com/company/core-api",
  "policy_id": "policy-uuid"
}

Response:
{
  "id": "req-uuid",
  "status": "pending",
  "confidence": 75,
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### List Requests
```
GET /requests?status=pending&urgency=high&limit=50&offset=0
Headers: Authorization: Bearer <token>

Query Parameters:
- status: pending|approved|denied|provisioning|completed
- urgency: low|medium|high
- type: request type
- limit: 1-100 (default: 50)
- offset: pagination offset (default: 0)

Response:
{
  "requests": [...],
  "limit": 50,
  "offset": 0
}
```

#### Get Request Details
```
GET /requests/:requestId
Headers: Authorization: Bearer <token>

Response:
{
  "id": "req-uuid",
  "title": "GitHub repo access",
  "status": "pending",
  "confidence": 75,
  "created_at": "2024-01-15T10:30:00Z",
  "user_id": "user-uuid",
  "approver_id": null
}
```

#### Approve/Deny Request
```
PATCH /requests/:requestId/approval
Headers: Authorization: Bearer <token>

Request:
{
  "status": "approved|denied",
  "notes": "Optional approval notes"
}

Response:
{
  "id": "req-uuid",
  "status": "approved",
  "approved_at": "2024-01-15T11:00:00Z",
  "approver_id": "user-uuid"
}
```

#### List Exceptions
```
GET /requests/exceptions/list?limit=50
Headers: Authorization: Bearer <token>

Response:
{
  "exceptions": [
    {
      "id": "exc-uuid",
      "request_id": "req-uuid",
      "title": "AWS Production Console Access",
      "urgency": "high",
      "policy_conflict": {...},
      "recommendation": "Approve with constraints",
      "status": "pending"
    }
  ],
  "limit": 50
}
```

### Policies

#### Create Policy
```
POST /policies
Headers: Authorization: Bearer <token>

Request:
{
  "name": "SaaS Provisioning",
  "description": "Standard tools under $50/month",
  "threshold": "<$50/mo",
  "auto_approval_rate": 94
}

Response:
{
  "id": "policy-uuid",
  "name": "SaaS Provisioning",
  "auto_approval_rate": 94,
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### List Policies
```
GET /policies?limit=50
Headers: Authorization: Bearer <token>

Response:
{
  "policies": [...]
}
```

#### Get Policy
```
GET /policies/:policyId
Headers: Authorization: Bearer <token>

Response: { policy object }
```

#### Update Policy
```
PATCH /policies/:policyId
Headers: Authorization: Bearer <token>

Request:
{
  "auto_approval_rate": 96
}

Response: { updated policy object }
```

#### Delete Policy
```
DELETE /policies/:policyId
Headers: Authorization: Bearer <token>

Response: HTTP 204 No Content
```

### Users

#### Get Current User
```
GET /users/me
Headers: Authorization: Bearer <token>

Response:
{
  "id": "user-uuid",
  "email": "user@company.com",
  "name": "John Doe",
  "role": "manager",
  "org_id": "org-uuid"
}
```

#### List Organization Users
```
GET /users?limit=50&offset=0
Headers: Authorization: Bearer <token>
Required Role: admin, exec

Response:
{
  "users": [...],
  "limit": 50,
  "offset": 0
}
```

#### Invite User
```
POST /users/invite
Headers: Authorization: Bearer <token>
Required Role: admin, exec

Request:
{
  "email": "newuser@company.com",
  "name": "Jane Smith",
  "role": "manager"
}

Response:
{
  "user": { "id", "email", "name", "role" },
  "tempPassword": "temp_pass_123"
}
```

#### Update User Role
```
PATCH /users/:userId/role
Headers: Authorization: Bearer <token>
Required Role: admin, exec

Request:
{
  "role": "admin"
}

Response: { updated user object }
```

### Billing

#### Get Subscription Status
```
GET /billing/subscription
Headers: Authorization: Bearer <token>
Required Role: admin, exec

Response:
{
  "subscription": {
    "status": "active",
    "tier": "professional",
    "plan": {
      "price": 299,
      "seats": 25,
      "requests_per_month": 10000
    }
  },
  "usage": {
    "user_count": 12,
    "request_count": 2500,
    "approved_count": 2300,
    "pending_exceptions": 3
  }
}
```

#### Create Checkout Session
```
POST /billing/checkout
Headers: Authorization: Bearer <token>
Required Role: admin, exec

Request:
{
  "plan": "professional"
}

Response:
{
  "sessionId": "cs_test_..."
}
```

#### Cancel Subscription
```
POST /billing/cancel
Headers: Authorization: Bearer <token>
Required Role: admin, exec

Response:
{
  "message": "Subscription cancelled"
}
```

### Admin

#### Get Organization Stats
```
GET /admin/stats
Headers: Authorization: Bearer <token>
Required Role: admin, exec

Response:
{
  "user_count": 45,
  "request_count": 1250,
  "approved_count": 1100,
  "pending_exceptions": 5
}
```

#### Get Audit Logs
```
GET /admin/audit-logs?action=REQUEST_CREATED&limit=100
Headers: Authorization: Bearer <token>
Required Role: admin, exec

Query Parameters:
- action: audit action type
- entity_type: users|requests|policies|organizations
- user_id: filter by user
- limit: 1-100
- offset: pagination

Response:
{
  "logs": [
    {
      "id": "log-uuid",
      "action": "REQUEST_CREATED",
      "entity_type": "request",
      "user_id": "user-uuid",
      "created_at": "2024-01-15T10:30:00Z",
      "details": {...}
    }
  ],
  "limit": 100,
  "offset": 0
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Missing required fields",
  "requestId": "req-uuid",
  "status": 400
}
```

### 401 Unauthorized
```json
{
  "error": "Missing authorization header",
  "requestId": "req-uuid",
  "status": 401
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions",
  "requestId": "req-uuid",
  "status": 403
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "path": "/api/v1/requests/invalid-id",
  "status": 404
}
```

### 409 Conflict
```json
{
  "error": "Email already registered",
  "requestId": "req-uuid",
  "status": 409
}
```

### 429 Too Many Requests
```json
{
  "error": "Too many requests, please try again later"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "requestId": "req-uuid",
  "status": 500
}
```

## Rate Limiting
- **Default**: 100 requests per 15 minutes per IP
- **Header**: `RateLimit-Remaining`
- **Exceeded**: Returns 429 status

## Request/Response Formats

### Date Format
All dates use ISO 8601 format: `2024-01-15T10:30:00Z`

### Pagination
```json
{
  "items": [...],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "pages": 3
  }
}
```

## Webhook Events (Stripe)
- `checkout.session.completed` - Subscription started
- `customer.subscription.deleted` - Subscription cancelled

---

For questions or integration support, contact: api-support@orbitresolve.com
