# Multi-stage build for production deployment
FROM node:25-alpine AS builder

# Toolchain for native modules (node-pty, better-sqlite3) - alpine/musl has no
# prebuilt binaries for them, so npm falls back to node-gyp
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci --legacy-peer-deps

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:25-alpine

# Install production dependencies
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies; the native-module toolchain is only
# needed during npm ci, so drop it afterwards to keep the image small
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
  && npm ci --omit=dev --legacy-peer-deps \
  && apk del .build-deps

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Create data directory
RUN mkdir -p /app/data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4000
ENV DATA_DIRECTORY=/app/data
# Bind on all interfaces inside the container - reachability is controlled by
# how the port is published (compose publishes it on 127.0.0.1 only)
ENV HOST=0.0.0.0

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Run from dist/ so the server finds its static files in ./public;
# the compiled entry is dist/server/server/index.js (see tsconfig.server.json)
WORKDIR /app/dist
CMD ["node", "server/server/index.js"]
