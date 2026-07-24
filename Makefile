# Makefile for Local Coder

.PHONY: help install build start test lint clean docker-build docker-run deploy health-check

# Default target
help:
	@echo "Local Coder - Available Commands"
	@echo "=================================="
	@echo ""
	@echo "Development:"
	@echo "  make install       - Install dependencies"
	@echo "  make start         - Start development server"
	@echo "  make build         - Build for production"
	@echo "  make test          - Run tests"
	@echo "  make lint          - Run type checking"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build  - Build Docker image"
	@echo "  make docker-run    - Run with Docker Compose"
	@echo "  make docker-dev    - Run development with Docker"
	@echo "  make docker-stop   - Stop Docker containers"
	@echo "  make docker-logs   - View Docker logs"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy ENV=staging VERSION=latest    - Deploy to environment"
	@echo "  make rollback ENV=production              - Rollback deployment"
	@echo "  make health-check URL=http://localhost:4000 - Check application health"
	@echo ""
	@echo "Kubernetes:"
	@echo "  make k8s-deploy-staging     - Deploy to staging"
	@echo "  make k8s-deploy-production  - Deploy to production"
	@echo "  make k8s-status            - Check deployment status"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean         - Clean build artifacts"
	@echo "  make format        - Format code"
	@echo ""

# Development
install:
	npm install

start:
	npm start

build:
	npm run build

test:
	npm test

lint:
	npm run lint

clean:
	rm -rf dist/
	rm -rf node_modules/
	rm -rf .vite/

format:
	@echo "Code formatting (add prettier if needed)"

# Docker
docker-build:
	docker build -t local-coder:latest .

docker-build-dev:
	docker build -t local-coder:dev -f Dockerfile.dev .

docker-run:
	docker-compose up -d

docker-dev:
	docker-compose --profile dev up -d

docker-stop:
	docker-compose down

docker-logs:
	docker-compose logs -f

docker-clean:
	docker-compose down -v
	docker rmi local-coder:latest local-coder:dev 2>/dev/null || true

# Deployment
deploy:
	@bash scripts/deploy.sh $(ENV) $(VERSION)

rollback:
	@bash scripts/rollback.sh $(ENV) $(REVISION)

health-check:
	@bash scripts/health-check.sh $(URL)

# Kubernetes
k8s-deploy-staging:
	kubectl apply -k k8s/environments/staging

k8s-deploy-production:
	kubectl apply -k k8s/environments/production

k8s-status:
	kubectl get pods,deployments,services -l app=local-coder

k8s-logs:
	kubectl logs -f -l app=local-coder --tail=100

k8s-rollback:
	kubectl rollout undo deployment/local-coder

k8s-scale:
	kubectl scale deployment/local-coder --replicas=$(REPLICAS)

# CI/CD
ci-build:
	npm ci
	npm run lint
	npm run build

ci-test:
	npm ci
	npm test

# Production
prod-build:
	NODE_ENV=production npm run build

prod-start:
	NODE_ENV=production PORT=4000 node dist/index.js
