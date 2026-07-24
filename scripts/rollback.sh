#!/bin/bash

# Rollback script for Local Coder
# Usage: ./scripts/rollback.sh [environment] [revision]

set -e

ENVIRONMENT=${1:-staging}
REVISION=${2:-0}  # 0 means rollback to previous revision
NAMESPACE="default"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Local Coder Rollback Script${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Revision: $REVISION (0 = previous)"
echo ""

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
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

# Show rollout history
echo -e "${GREEN}Deployment history:${NC}"
kubectl rollout history deployment/local-coder -n $NAMESPACE
echo ""

# Confirm rollback
read -p "Are you sure you want to rollback? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Rollback cancelled${NC}"
    exit 0
fi

# Perform rollback
echo -e "${YELLOW}Rolling back deployment...${NC}"
if [ "$REVISION" -eq 0 ]; then
    kubectl rollout undo deployment/local-coder -n $NAMESPACE
else
    kubectl rollout undo deployment/local-coder -n $NAMESPACE --to-revision=$REVISION
fi

# Wait for rollback to complete
echo -e "${GREEN}Waiting for rollback to complete...${NC}"
kubectl rollout status deployment/local-coder -n $NAMESPACE --timeout=5m

# Check deployment health
echo -e "${GREEN}Checking deployment health...${NC}"
kubectl get pods -n $NAMESPACE -l app=local-coder

# Show recent logs
echo ""
echo -e "${GREEN}Recent logs after rollback:${NC}"
kubectl logs -n $NAMESPACE -l app=local-coder --tail=20 --prefix=true

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Rollback Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
