#!/bin/bash

# Deployment script for Local Coder
# Usage: ./scripts/deploy.sh [environment] [version]

set -e

ENVIRONMENT=${1:-staging}
VERSION=${2:-latest}
NAMESPACE="default"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Local Coder Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Version: $VERSION"
echo ""

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

# Check if kustomize is installed
if ! command -v kustomize &> /dev/null; then
    echo -e "${YELLOW}Warning: kustomize is not installed. Using kubectl kustomize instead${NC}"
    KUSTOMIZE_CMD="kubectl kustomize"
else
    KUSTOMIZE_CMD="kustomize"
fi

# Set namespace based on environment
case $ENVIRONMENT in
    production)
        NAMESPACE="production"
        ;;
    staging)
        NAMESPACE="staging"
        ;;
    development)
        NAMESPACE="development"
        ;;
    *)
        echo -e "${YELLOW}Unknown environment: $ENVIRONMENT, using default namespace${NC}"
        ;;
esac

echo "Target namespace: $NAMESPACE"
echo ""

# Create namespace if it doesn't exist
echo -e "${GREEN}Creating namespace if it doesn't exist...${NC}"
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Check if environment-specific kustomization exists
KUSTOMIZE_DIR="k8s/environments/$ENVIRONMENT"
if [ ! -d "$KUSTOMIZE_DIR" ]; then
    echo -e "${YELLOW}No environment-specific configuration found, using base configuration${NC}"
    KUSTOMIZE_DIR="k8s"
fi

# Update image tag in kustomization
echo -e "${GREEN}Updating image tag to: $VERSION${NC}"
cd $KUSTOMIZE_DIR
if command -v kustomize &> /dev/null; then
    kustomize edit set image ghcr.io/your-username/local-coder:$VERSION
fi
cd - > /dev/null

# Build and apply manifests
echo -e "${GREEN}Building Kubernetes manifests...${NC}"
$KUSTOMIZE_CMD build $KUSTOMIZE_DIR > /tmp/local-coder-manifests.yaml

echo -e "${GREEN}Applying manifests to cluster...${NC}"
kubectl apply -f /tmp/local-coder-manifests.yaml -n $NAMESPACE

# Wait for deployment to complete
echo -e "${GREEN}Waiting for deployment to complete...${NC}"
kubectl rollout status deployment/local-coder -n $NAMESPACE --timeout=5m

# Check deployment health
echo -e "${GREEN}Checking deployment health...${NC}"
kubectl get pods -n $NAMESPACE -l app=local-coder

# Get service URL
echo ""
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo ""
echo "Service endpoints:"
kubectl get services -n $NAMESPACE -l app=local-coder
echo ""

if kubectl get ingress -n $NAMESPACE local-coder-ingress &> /dev/null; then
    echo "Ingress:"
    kubectl get ingress -n $NAMESPACE local-coder-ingress
    echo ""
fi

# Show recent logs
echo -e "${GREEN}Recent logs from deployment:${NC}"
kubectl logs -n $NAMESPACE -l app=local-coder --tail=20 --prefix=true

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
