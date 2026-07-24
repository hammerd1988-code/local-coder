#!/bin/bash

# Health check script for Local Coder
# Usage: ./scripts/health-check.sh [url]

URL=${1:-http://localhost:4000}
HEALTH_ENDPOINT="$URL/api/health"
MAX_RETRIES=5
RETRY_DELAY=2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Health Check Script${NC}"
echo "Checking: $HEALTH_ENDPOINT"
echo ""

# Function to check health
check_health() {
    response=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_ENDPOINT" 2>/dev/null)
    return $?
}

# Retry loop
for i in $(seq 1 $MAX_RETRIES); do
    echo "Attempt $i/$MAX_RETRIES..."
    
    if check_health; then
        http_code=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_ENDPOINT")
        
        if [ "$http_code" -eq 200 ]; then
            echo -e "${GREEN}✓ Health check passed (HTTP $http_code)${NC}"
            
            # Get detailed health info
            health_data=$(curl -s "$HEALTH_ENDPOINT")
            echo ""
            echo "Health details:"
            echo "$health_data" | jq '.' 2>/dev/null || echo "$health_data"
            
            exit 0
        else
            echo -e "${YELLOW}⚠ Unexpected HTTP code: $http_code${NC}"
        fi
    else
        echo -e "${RED}✗ Connection failed${NC}"
    fi
    
    if [ $i -lt $MAX_RETRIES ]; then
        echo "Waiting ${RETRY_DELAY}s before retry..."
        sleep $RETRY_DELAY
    fi
done

echo ""
echo -e "${RED}Health check failed after $MAX_RETRIES attempts${NC}"
exit 1
