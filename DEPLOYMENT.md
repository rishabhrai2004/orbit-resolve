# Orbit Resolve — Comprehensive Setup Guide

## System Requirements

- **OS**: Linux (Ubuntu 20.04+, CentOS 8+) or macOS 12+
- **Node.js**: 18.0.0 or higher
- **PostgreSQL**: 14.0 or higher
- **Memory**: 2GB minimum (4GB recommended)
- **Disk**: 10GB minimum (50GB recommended for production)

## Local Development Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/orbit-resolve.git
cd orbit-resolve
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup

**Using Docker (Recommended)**
```bash
docker-compose up -d postgres
```

**Manual PostgreSQL Installation**
```bash
brew install postgresql@15  # macOS
sudo apt-get install postgresql-15  # Ubuntu

createdb orbit_resolve
psql orbit_resolve -U postgres -f scripts/schema.sql
```

### 4. Environment Configuration
```bash
cp .env.local .env
# Edit .env with your settings
```

### 5. Run Migrations
```bash
npm run migrate
npm run seed
```

### 6. Start Development Server
```bash
npm run dev
```

The server will start at `http://localhost:3000`

## Testing API

### Use Provided Postman Collection
1. Import `POSTMAN_COLLECTION.json` into Postman
2. Set `auth_token` variable after login

### Quick Test
```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"password123"}'

# Create request
curl -X POST http://localhost:3000/api/v1/requests \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"GitHub repo access",
    "type":"SaaS Provisioning",
    "urgency":"low"
  }'
```

## Production Deployment

### Cloud Hosting Options

#### AWS Elastic Beanstalk
```bash
eb init -p node.js-18 orbit-resolve
eb create orbit-prod
eb deploy
```

#### Heroku
```bash
heroku create orbit-resolve
git push heroku main
heroku run npm run migrate
```

#### Docker + Kubernetes
```bash
docker build -t orbit-resolve:v3.0.0 .
docker tag orbit-resolve:v3.0.0 registry.example.com/orbit-resolve:v3.0.0
docker push registry.example.com/orbit-resolve:v3.0.0

kubectl apply -f k8s/deployment.yaml
```

### Environment Variables (Production)
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:password@prod-db.example.com:5432/orbit_resolve
JWT_SECRET=<generate-secure-random-key>
STRIPE_SECRET_KEY=sk_live_...
CORS_ORIGIN=https://app.orbitresolve.com
```

### Database Backup
```bash
pg_dump orbit_resolve > backup.sql
# Restore: psql orbit_resolve < backup.sql
```

### SSL/HTTPS Setup
```bash
# Using Let's Encrypt + Nginx
certbot certonly --standalone -d app.orbitresolve.com
```

## Monitoring & Logging

### Application Logs
```bash
# Development
npm run dev 2>&1 | tee orbit.log

# Production (with systemd)
journalctl -u orbit-resolve -f
```

### Health Check
```bash
curl http://localhost:3000/health
```

### Database Monitoring
```bash
psql orbit_resolve
\dt  # List tables
\di  # List indexes
SELECT COUNT(*) FROM requests;
```

## Scaling Considerations

1. **Load Balancing**: Use NGINX or HAProxy for distribution
2. **Caching**: Implement Redis for session/policy cache
3. **CDN**: CloudFront or Cloudflare for static assets
4. **Database**: Read replicas for scaling queries
5. **Message Queue**: Bull/Redis for async request processing

## Security Checklist

- [ ] Enable HTTPS/TLS
- [ ] Set strong JWT_SECRET (32+ characters)
- [ ] Configure firewall rules
- [ ] Enable database encryption
- [ ] Set up WAF rules
- [ ] Enable audit logging
- [ ] Regular security audits
- [ ] Keep dependencies updated

## Troubleshooting

### Database Connection Failed
```bash
# Check PostgreSQL status
psql -U postgres -d orbit_resolve

# Verify DATABASE_URL
echo $DATABASE_URL
```

### Port Already in Use
```bash
# Find process on port 3000
lsof -i :3000
kill -9 <PID>
```

### Migration Failed
```bash
# Reset database (development only)
dropdb orbit_resolve
createdb orbit_resolve
npm run migrate
npm run seed
```

## Support & Documentation

- API Docs: See POSTMAN_COLLECTION.json
- GitHub Issues: Report bugs
- Security: security@orbitresolve.com

---

**Orbit Resolve v3.0.0** — Ready for Enterprise
