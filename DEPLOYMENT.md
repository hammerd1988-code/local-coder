# Deployment Guide

This guide covers deploying the Local Coder application using various methods.

## Table of Contents
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [CI/CD Pipelines](#cicd-pipelines)
- [Environment Variables](#environment-variables)
- [Production Considerations](#production-considerations)

## Docker Deployment

### Using Docker Compose (Production)

1. **Build and start the application:**
   ```bash
   docker-compose up -d
   ```

2. **View logs:**
   ```bash
   docker-compose logs -f
   ```

3. **Stop the application:**
   ```bash
   docker-compose down
   ```

### Using Docker Compose (Development)

1. **Start development environment:**
   ```bash
   docker-compose --profile dev up -d
   ```

2. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

### Building Docker Images Manually

1. **Production image:**
   ```bash
   docker build -t local-coder:latest .
   docker run -p 4000:4000 -v ./data:/app/data local-coder:latest
   ```

2. **Development image:**
   ```bash
   docker build -t local-coder:dev -f Dockerfile.dev .
   docker run -p 3000:3000 -p 3001:3001 -v .:/app local-coder:dev
   ```

## Kubernetes Deployment

### Prerequisites
- Kubernetes cluster (v1.24+)
- kubectl configured
- Container registry access

### Deploy to Kubernetes

1. **Update image in deployment.yml:**
   ```yaml
   image: ghcr.io/your-username/local-coder:latest
   ```

2. **Apply Kubernetes manifests:**
   ```bash
   kubectl apply -f k8s/deployment.yml
   kubectl apply -f k8s/ingress.yml
   kubectl apply -f k8s/hpa.yml
   ```

3. **Check deployment status:**
   ```bash
   kubectl get deployments
   kubectl get pods
   kubectl get services
   ```

4. **View logs:**
   ```bash
   kubectl logs -f deployment/local-coder
   ```

### Scaling

Manual scaling:
```bash
kubectl scale deployment/local-coder --replicas=5
```

Auto-scaling is configured via HPA (Horizontal Pod Autoscaler) in `k8s/hpa.yml`.

## CI/CD Pipelines

### GitHub Actions

The project includes three GitHub Actions workflows:

1. **CI Pipeline** (`.github/workflows/ci.yml`)
   - Runs on push/PR to main/develop
   - Type checking
   - Linting
   - Building
   - Security scanning

2. **Docker Build** (`.github/workflows/docker-build.yml`)
   - Builds and pushes Docker images
   - Runs on push to main/develop and tags
   - Pushes to GitHub Container Registry

3. **Deploy** (`.github/workflows/deploy.yml`)
   - Deploys to staging/production
   - Runs on tags or manual trigger

#### Setup GitHub Actions

1. **Configure secrets in GitHub:**
   - Go to Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `STAGING_DEPLOY_URL`
     - `PRODUCTION_DEPLOY_URL`
     - Add any cloud provider credentials if needed

2. **Enable GitHub Container Registry:**
   - Workflows automatically push to `ghcr.io`
   - Images are tagged with branch name, PR number, or version

3. **Trigger deployment:**
   ```bash
   # Tag a release
   git tag v1.0.0
   git push origin v1.0.0
   
   # Or use manual workflow dispatch
   ```

### GitLab CI

The project includes a comprehensive GitLab CI pipeline (`.gitlab-ci.yml`):

#### Pipeline Stages
1. **Lint** - Type checking and code quality
2. **Test** - Run tests and generate coverage
3. **Build** - Build application and Docker images
4. **Scan** - Security scanning with Trivy
5. **Deploy** - Deploy to staging/production

#### Setup GitLab CI

1. **Configure CI/CD variables:**
   - Go to Settings → CI/CD → Variables
   - Add the following variables:
     - `STAGING_URL`
     - `PRODUCTION_URL`
     - Add cloud provider credentials if needed

2. **Registry authentication:**
   - GitLab CI automatically authenticates to GitLab Container Registry
   - Images pushed to `$CI_REGISTRY_IMAGE`

3. **Deploy to staging:**
   - Push to `develop` branch
   - Manual trigger from pipeline

4. **Deploy to production:**
   - Push tag or merge to `main`
   - Manual trigger from pipeline

## Environment Variables

### Required Variables

- `NODE_ENV` - Environment mode (production/development)
- `PORT` - Application port (default: 4000 production, 3001 development)
- `DATA_DIRECTORY` - Path to persistent data directory

### Optional Variables

- Add custom environment variables in `.env` file
- Update `docker-compose.yml` or `k8s/deployment.yml` accordingly

Example `.env` file:
```env
NODE_ENV=production
PORT=4000
DATA_DIRECTORY=/app/data
```

## Production Considerations

### Security

1. **Use HTTPS in production:**
   - Configure SSL certificates in Nginx
   - Update `nginx/nginx.conf` with your domain
   - Use Let's Encrypt or other certificate provider

2. **Secure secrets:**
   - Never commit secrets to repository
   - Use Kubernetes secrets or environment variables
   - Rotate credentials regularly

3. **Rate limiting:**
   - Nginx configuration includes rate limiting
   - Adjust limits based on your needs

### Performance

1. **Resource limits:**
   - Set appropriate CPU/memory limits in Kubernetes
   - Monitor resource usage

2. **Horizontal scaling:**
   - HPA automatically scales based on CPU/memory
   - Adjust min/max replicas as needed

3. **Caching:**
   - Nginx caches static assets
   - Configure CDN for better performance

### Monitoring

1. **Health checks:**
   - Available at `/api/health`
   - Returns application status and uptime

2. **Logs:**
   - Application logs to stdout/stderr
   - Kubernetes captures logs automatically
   - Configure log aggregation (ELK, Loki, etc.)

3. **Metrics:**
   - Add Prometheus metrics endpoint
   - Configure Grafana dashboards
   - Set up alerting

### Backup

1. **Database backup:**
   - Regular backups of SQLite database
   - Store in persistent volume or S3

2. **Volume snapshots:**
   - Take regular snapshots of Kubernetes PVs
   - Test restore procedures

### Updates

1. **Rolling updates:**
   - Kubernetes performs zero-downtime updates
   - Configure appropriate readiness/liveness probes

2. **Rollback:**
   - Use kubectl rollout undo if needed
   - CI/CD pipelines include rollback jobs

## Troubleshooting

### Common Issues

1. **Container won't start:**
   ```bash
   docker logs local-coder
   kubectl logs -f deployment/local-coder
   ```

2. **Database issues:**
   - Check DATA_DIRECTORY permissions
   - Verify volume mounts

3. **Port conflicts:**
   - Change ports in docker-compose.yml or deployment.yml
   - Update environment variables

### Support

For additional help:
- Check application logs
- Review health check endpoint
- Consult documentation

## Deployment Scripts

### Quick Deployment

Use the provided deployment scripts for easier deployment:

```bash
# Deploy to staging
./scripts/deploy.sh staging latest

# Deploy to production
./scripts/deploy.sh production v1.0.0

# Rollback deployment
./scripts/rollback.sh production

# Health check
./scripts/health-check.sh https://your-domain.com
```

### Kustomize-based Deployment

Deploy using Kustomize for environment-specific configurations:

```bash
# Deploy staging environment
kubectl apply -k k8s/environments/staging

# Deploy production environment
kubectl apply -k k8s/environments/production

# Verify deployment
kubectl get all -n production
```

## Advanced Kubernetes Features

### ConfigMaps and Secrets

1. **Apply ConfigMap:**
   ```bash
   kubectl apply -f k8s/configmap.yml
   ```

2. **Create Secrets:**
   ```bash
   kubectl create secret generic local-coder-secrets \
     --from-literal=api-key=your-api-key \
     --from-literal=database-password=your-password
   ```

### Network Policies

Apply network policies for security:
```bash
kubectl apply -f k8s/network-policy.yml
```

### Monitoring with Prometheus

Deploy ServiceMonitor for Prometheus integration:
```bash
kubectl apply -f k8s/service-monitor.yml
```

## CI/CD Workflows

### Available GitHub Actions Workflows

1. **CI Pipeline** - Automated testing and linting
2. **Docker Build** - Build and push container images
3. **Deploy** - Deploy to environments
4. **Release** - Create GitHub releases
5. **Code Quality** - Code review and quality checks
6. **Cleanup** - Clean up old artifacts and images

### Workflow Triggers

- **CI**: Push to main/develop, Pull requests
- **Docker Build**: Push to main/develop, Tags
- **Deploy**: Tags, Manual dispatch
- **Release**: Version tags (v*)
- **Code Quality**: Pull requests
- **Cleanup**: Weekly schedule, Manual

## Next Steps

- [ ] Configure domain and SSL certificates
- [ ] Set up monitoring and alerting with Prometheus/Grafana
- [ ] Configure automated backups
- [ ] Set up log aggregation (ELK/Loki)
- [ ] Add custom deployment targets
- [ ] Configure CDN for static assets
- [ ] Set up Dependabot for automated dependency updates
- [ ] Configure GitHub environments and protection rules
- [ ] Set up Slack/Discord notifications for deployments
- [ ] Implement canary deployments
- [ ] Add performance testing in CI/CD pipeline
