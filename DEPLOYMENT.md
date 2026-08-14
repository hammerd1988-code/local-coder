# Deployment Guide

This guide covers deploying Local Coder and the **NEO//OPS** server control deck using various methods.

## Table of Contents
- [NEO//OPS Server Deck (Bare Metal & Rack Clusters)](#neoops-server-deck-bare-metal--rack-clusters)
  - [One-Shot Bootstrap Script](#one-shot-bootstrap-script)
  - [Single Server Setup](#single-server-setup)
  - [Multi-Node Rack Cluster (Single Dashboard)](#multi-node-rack-cluster-single-dashboard)
  - [Adding Nodes Down the Road](#adding-nodes-down-the-road)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [CI/CD Pipelines](#cicd-pipelines)
- [Environment Variables](#environment-variables)
- [Production Considerations](#production-considerations)

---

## NEO//OPS Server Deck (Bare Metal & Rack Clusters)

NEO//OPS is designed to manage Ubuntu host servers directly (system telemetry, full-disk navigation, terminal, processes, daemons, network, logs).

> **Important Security Architecture**: By default, NEO//OPS binds exclusively to `127.0.0.1:4000` on each node. Access from your workstation is secured using an SSH port forward (`ssh -L`), keeping the unauthenticated root-capability APIs completely off the public or LAN network.

### One-Shot Bootstrap Script

On any fresh Ubuntu Server node (e.g. Dell PowerEdge):

```bash
# Clone and run the automated installer as root:
git clone https://github.com/hammerd1988-code/local-coder.git /opt/neo-ops
sudo bash /opt/neo-ops/scripts/install-neo-ops.sh
```

The script automatically:
1. Installs Node.js 22 LTS and native build toolchains (`build-essential`, `python3`)
2. Runs `npm ci` and builds the production bundle (`dist/`)
3. Writes the environment config (`/opt/neo-ops/neo-ops.env`)
4. Configures and starts the `neo-ops.service` systemd daemon

### Single Server Setup

Once installed, connect to the server from your workstation using an SSH tunnel:

```bash
# Open SSH tunnel to the server
ssh -L 4000:localhost:4000 ubuntu@<server-ip>

# Open in browser:
http://localhost:4000/ops
```

### Multi-Node Rack Cluster (Single Dashboard)

To manage multiple nodes (e.g., a 4-node Dell PowerEdge rack) from a **single dashboard**:

1. **Install NEO//OPS on every node** using `install-neo-ops.sh`.
2. **Choose one node as the Hub** (e.g., `node1`).
3. **Set up SSH key access from the Hub to peer nodes**:
   ```bash
   # On the Hub node (as root or the service user):
   ssh-keygen -t ed25519 -N "" -f /root/.ssh/id_ed25519
   ssh-copy-id ubuntu@node2-ip
   ssh-copy-id ubuntu@node3-ip
   ssh-copy-id ubuntu@node4-ip
   ```
4. **Register the peer nodes on the Hub**:
   - **Option A (Automated via installer)**:
     ```bash
     sudo bash /opt/neo-ops/scripts/install-neo-ops.sh \
       --name "NODE-01" \
       --peer "name=NODE-02,host=10.0.0.12,user=ubuntu" \
       --peer "name=NODE-03,host=10.0.0.13,user=ubuntu" \
       --peer "name=NODE-04,host=10.0.0.14,user=ubuntu"
     ```
   - **Option B (From the GUI)**:
     Open the dashboard at `http://localhost:4000/ops`, click the **Node Switcher** in the top right header, click **`+`**, and enter the node details.
   - **Option C (Configuration file)**:
     Place a `nodes.json` in `/var/lib/neo-ops/nodes.json` (see `scripts/nodes.example.json`).

5. **Access the entire cluster**:
   ```bash
   # Connect only to the Hub node:
   ssh -L 4000:localhost:4000 ubuntu@<hub-ip>
   ```
   Open `http://localhost:4000/ops` — use the top-right Node Switcher to seamlessly switch between any node in the rack. All modules (telemetry, files, terminals, processes, services, network, logs) dynamically target the selected node.

### Adding Nodes Down the Road

When adding a new node to the cluster:
1. Run `install-neo-ops.sh` on the new node.
2. Ensure the Hub can SSH into it: `ssh-copy-id ubuntu@new-node-ip`.
3. In the Hub's NEO//OPS web GUI, click the **Node Switcher** → **`+`** → Enter label & IP → **Establish Uplink**.
4. The Hub instantly establishes the background SSH tunnel and the new node appears in your switcher roster without restarting the service.

---

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
